from datetime import date, timedelta
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings

from apps.business.models import Company
from apps.pulse.models import (
    Opportunity,
    OpportunityReminderEmailKind,
    OpportunityReminderEmailLog,
    OpportunityStatus,
    PulseContact,
)
from apps.pulse.reminder_emails import send_due_opportunity_date_reminders
from apps.pulse.services import pulse_service
from apps.users.models import User, UserRole


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='noreply@test.local',
    FRONTEND_URL='http://localhost:5173',
)
class OpportunityDateReminderEmailTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='assignee@test.com',
            name='Assignee',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.company = Company.objects.create(name='Reminder Co')
        self.contact = PulseContact.objects.create(
            name='Contact',
            company=self.company,
            email='contact@test.com',
        )
        self.today = date(2026, 9, 23)

    def _opp(self, **overrides):
        defaults = {
            'prospect_number': f'PRO-{Opportunity.objects.count() + 1:03d}',
            'name': 'Deal Alpha',
            'company': self.company,
            'contact': self.contact,
            'owner': self.owner,
            'stage': 'Negotiation',
            'status': OpportunityStatus.OPEN,
            'follow_up_date': None,
            'expected_close_date': None,
        }
        defaults.update(overrides)
        return Opportunity.objects.create(**defaults)

    def test_sends_follow_up_three_and_one_day_before(self):
        self._opp(follow_up_date=self.today + timedelta(days=3), prospect_number='PRO-FU3')
        self._opp(follow_up_date=self.today + timedelta(days=1), prospect_number='PRO-FU1')
        # not due today
        self._opp(follow_up_date=self.today + timedelta(days=2), prospect_number='PRO-FU2')

        result = send_due_opportunity_date_reminders(as_of_date=self.today)

        self.assertEqual(result.sent, 2)
        self.assertEqual(len(mail.outbox), 2)
        subjects = {m.subject for m in mail.outbox}
        self.assertTrue(any('follow-up' in s and 'PRO-FU3' in s for s in subjects))
        self.assertTrue(any('follow-up' in s and 'PRO-FU1' in s for s in subjects))
        self.assertEqual(
            OpportunityReminderEmailLog.objects.filter(
                reminder_kind=OpportunityReminderEmailKind.FOLLOW_UP,
            ).count(),
            2,
        )

    def test_sends_close_date_three_and_one_day_before(self):
        self._opp(expected_close_date=self.today + timedelta(days=3), prospect_number='PRO-CL3')
        self._opp(expected_close_date=self.today + timedelta(days=1), prospect_number='PRO-CL1')

        result = send_due_opportunity_date_reminders(as_of_date=self.today)

        self.assertEqual(result.sent, 2)
        self.assertEqual(len(mail.outbox), 2)
        self.assertTrue(all(m.to == ['assignee@test.com'] for m in mail.outbox))
        self.assertEqual(
            OpportunityReminderEmailLog.objects.filter(
                reminder_kind=OpportunityReminderEmailKind.CLOSE,
            ).count(),
            2,
        )

    def test_skips_duplicate_send(self):
        opp = self._opp(follow_up_date=self.today + timedelta(days=3), prospect_number='PRO-DUP')
        first = send_due_opportunity_date_reminders(as_of_date=self.today)
        second = send_due_opportunity_date_reminders(as_of_date=self.today)

        self.assertEqual(first.sent, 1)
        self.assertEqual(second.sent, 0)
        self.assertEqual(second.skipped, 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            OpportunityReminderEmailLog.objects.filter(opportunity=opp).count(),
            1,
        )

    def test_skips_won_lost_and_missing_owner(self):
        self._opp(
            follow_up_date=self.today + timedelta(days=3),
            prospect_number='PRO-WIN',
            stage='Win',
            status=OpportunityStatus.WON,
        )
        self._opp(
            follow_up_date=self.today + timedelta(days=3),
            prospect_number='PRO-LOST',
            stage='Lost',
            status=OpportunityStatus.LOST,
        )
        self._opp(
            follow_up_date=self.today + timedelta(days=3),
            prospect_number='PRO-NOOWNER',
            owner=None,
        )

        result = send_due_opportunity_date_reminders(as_of_date=self.today)
        self.assertEqual(result.sent, 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_service_and_management_command(self):
        self._opp(follow_up_date=self.today + timedelta(days=1), prospect_number='PRO-CMD')
        result = pulse_service.send_due_opportunity_date_reminders(as_of_date=self.today)
        self.assertEqual(result.sent, 1)

        from django.core.management import call_command
        from io import StringIO

        out = StringIO()
        call_command('send_opportunity_date_reminders', f'--as-of={self.today.isoformat()}', stdout=out)
        self.assertIn('sent=0', out.getvalue())  # already logged

    @patch('apps.pulse.reminder_emails.send_mail', side_effect=RuntimeError('smtp down'))
    def test_failed_send_does_not_log(self, _mock_send):
        self._opp(follow_up_date=self.today + timedelta(days=3), prospect_number='PRO-FAIL')
        result = send_due_opportunity_date_reminders(as_of_date=self.today)
        self.assertEqual(result.failed, 1)
        self.assertEqual(OpportunityReminderEmailLog.objects.count(), 0)
