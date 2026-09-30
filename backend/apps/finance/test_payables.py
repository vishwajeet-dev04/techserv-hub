import importlib
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from django.apps import apps as django_apps
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.finance.models import Payable, PayableReminderEmailLog, PayableStatus
from apps.finance.payable_reminders import reminder_recipients, send_payable_due_reminders
from apps.users.models import User, UserRole

SAMPLE_MIS = Path(__file__).resolve().parents[3] / 'PROJECT_CONTEXT' / 'Files' / 'Sample data for MIS.xlsx'


def _payable(**overrides) -> Payable:
    defaults = {
        'vendor': 'Rent Co',
        'category': 'Rent',
        'invoice_number': f'INV-{Payable.objects.count() + 1}',
        'total_amount': Decimal('118000'),
        'payable_amount': Decimal('118000'),
        'status': PayableStatus.PENDING,
    }
    defaults.update(overrides)
    return Payable.objects.create(**defaults)


class PayableInvoiceDateTests(APITestCase):
    def setUp(self):
        self.finance_user = User.objects.create_user(
            email='payables-fin@test.com', name='Fin', password='pass12345', role=UserRole.FINANCE,
        )
        self.client.force_authenticate(self.finance_user)

    def test_due_date_defaults_to_invoice_plus_30(self):
        row = _payable(invoice_date=date(2026, 8, 5))
        self.assertEqual(row.due_date, date(2026, 9, 4))

    def test_explicit_due_date_is_kept(self):
        row = _payable(invoice_date=date(2026, 8, 5), due_date=date(2026, 8, 20))
        self.assertEqual(row.due_date, date(2026, 8, 20))

    def test_api_create_derives_due_date(self):
        response = self.client.post(
            '/api/v1/finance/payables/',
            {
                'vendor': 'AWS India', 'invoice_number': 'AWS-1', 'invoice_date': '2026-08-20',
                'total_amount': '1000', 'payable_amount': '1000',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['invoice_date'], '2026-08-20')
        self.assertEqual(response.data['due_date'], '2026-09-19')

    def test_date_filter_uses_invoice_date(self):
        _payable(invoice_number='AUG', invoice_date=date(2026, 8, 10))
        _payable(invoice_number='JUL', invoice_date=date(2026, 7, 25))
        response = self.client.get('/api/v1/finance/payables/', {'from': '2026-08-01', 'to': '2026-08-31'})
        self.assertEqual([row['invoice_number'] for row in response.data['results']], ['AUG'])
        summary = self.client.get(
            '/api/v1/finance/ledger/summary/', {'page': 'payables', 'from': '2026-08-01', 'to': '2026-08-31'},
        )
        self.assertEqual(summary.data['total_payable'], 118000.0)

    def test_migration_moves_old_due_date_to_invoice_date(self):
        migration = importlib.import_module('apps.finance.migrations.0010_payable_invoice_date')
        legacy = _payable(invoice_number='LEGACY', due_date=date(2026, 8, 1))
        Payable.objects.filter(pk=legacy.pk).update(invoice_date=None)
        migration.move_due_to_invoice_date(django_apps, None)
        legacy.refresh_from_db()
        self.assertEqual(legacy.invoice_date, date(2026, 8, 1))
        self.assertEqual(legacy.due_date, date(2026, 8, 31))
        migration.move_due_to_invoice_date(django_apps, None)
        legacy.refresh_from_db()
        self.assertEqual(legacy.due_date, date(2026, 8, 31))

    def test_mis_import_sets_invoice_and_due_dates(self):
        self.assertTrue(SAMPLE_MIS.exists(), f'Missing fixture: {SAMPLE_MIS}')
        from apps.finance.mis_import import import_mis_path

        import_mis_path(SAMPLE_MIS)
        rows = list(Payable.objects.all())
        self.assertTrue(rows)
        for row in rows:
            self.assertIsNotNone(row.invoice_date)
            self.assertEqual(row.due_date, row.invoice_date + timedelta(days=30))


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class PayableReminderTests(TestCase):
    def setUp(self):
        self.today = date(2026, 9, 23)
        User.objects.create_user(email='fin@test.com', name='Fin', password='pass12345', role=UserRole.FINANCE)
        User.objects.create_user(email='admin@test.com', name='Admin', password='pass12345', role=UserRole.ADMIN)
        User.objects.create_user(email='sales@test.com', name='Sales', password='pass12345', role=UserRole.SALES)
        User.objects.create_user(
            email='gone@test.com', name='Gone', password='pass12345', role=UserRole.FINANCE, is_active=False,
        )

    def test_recipients_are_active_finance_and_admin(self):
        self.assertEqual(reminder_recipients(), ['admin@test.com', 'fin@test.com'])

    def test_sends_three_day_and_one_day_reminders(self):
        _payable(vendor='Three Day', due_date=self.today + timedelta(days=3))
        _payable(vendor='One Day', due_date=self.today + timedelta(days=1))
        _payable(vendor='Two Day', due_date=self.today + timedelta(days=2))
        result = send_payable_due_reminders(as_of_date=self.today)
        self.assertEqual(result.sent, 2)
        self.assertEqual(len(mail.outbox), 2)
        subjects = sorted(message.subject for message in mail.outbox)
        self.assertTrue(any('due in 3 days' in subject for subject in subjects), subjects)
        self.assertTrue(any('due tomorrow' in subject for subject in subjects), subjects)
        bodies = '\n'.join(message.body for message in mail.outbox)
        self.assertIn('Three Day', bodies)
        self.assertIn('One Day', bodies)
        self.assertNotIn('Two Day', bodies)
        self.assertIn('Invoice date', bodies)
        self.assertIn('Rs. 1,18,000.00', bodies)
        for message in mail.outbox:
            self.assertEqual(sorted(message.to), ['admin@test.com', 'fin@test.com'])

    def test_no_resend_and_paid_skipped(self):
        _payable(vendor='Pending', due_date=self.today + timedelta(days=3))
        _payable(vendor='Paid', due_date=self.today + timedelta(days=3), status=PayableStatus.PAID)
        first = send_payable_due_reminders(as_of_date=self.today)
        self.assertEqual(first.sent, 1)
        self.assertNotIn('Paid ·', mail.outbox[0].body)
        second = send_payable_due_reminders(as_of_date=self.today)
        self.assertEqual(second.sent, 0)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(PayableReminderEmailLog.objects.count(), 1)

    def test_failed_send_is_not_logged(self):
        _payable(due_date=self.today + timedelta(days=1))
        with patch('apps.finance.payable_reminders.send_mail', side_effect=RuntimeError('smtp down')):
            result = send_payable_due_reminders(as_of_date=self.today)
        self.assertEqual(result.failed, 1)
        self.assertFalse(PayableReminderEmailLog.objects.exists())

    def test_management_command(self):
        _payable(due_date=date(2026, 10, 1) + timedelta(days=1))
        call_command('send_payable_due_reminders', '--as-of', '2026-10-01', verbosity=0)
        self.assertEqual(len(mail.outbox), 1)
