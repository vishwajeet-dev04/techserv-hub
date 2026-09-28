from datetime import date
from decimal import Decimal
from pathlib import Path

from rest_framework import status
from rest_framework.test import APITestCase

from apps.finance.models import FinancialMetric, FinancialPeriod, PeriodType
from apps.users.models import User, UserRole


class FinancialMetricAPITests(APITestCase):
    def setUp(self):
        self.finance_user = User.objects.create_user(
            email='finance@test.com',
            name='Finance User',
            password='pass12345',
            role=UserRole.FINANCE,
        )
        self.sales_user = User.objects.create_user(
            email='sales@test.com',
            name='Sales User',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.client.force_authenticate(self.finance_user)
        self.period = FinancialPeriod.objects.create(
            period_type=PeriodType.MONTHLY,
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 31),
            label='Aug 2026',
        )

    def test_create_manual_metric(self):
        response = self.client.post(
            '/api/v1/finance/metrics/',
            {
                'financial_period': str(self.period.id),
                'metric_code': 'revenue',
                'value': '5000000.50',
                'currency': 'INR',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['metric_code'], 'revenue')
        self.assertEqual(Decimal(response.data['value']), Decimal('5000000.50'))
        self.assertTrue(response.data['is_manual'])
        metric = FinancialMetric.objects.get(id=response.data['id'])
        self.assertEqual(metric.created_by, self.finance_user)
        self.assertTrue(metric.is_manual)

    def test_create_rejects_invalid_metric_code(self):
        response = self.client.post(
            '/api/v1/finance/metrics/',
            {
                'financial_period': str(self.period.id),
                'metric_code': 'not_a_real_metric',
                'value': '100',
                'currency': 'INR',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_rejects_non_numeric_value(self):
        response = self.client.post(
            '/api/v1/finance/metrics/',
            {
                'financial_period': str(self.period.id),
                'metric_code': 'revenue',
                'value': 'abc',
                'currency': 'INR',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_updates_existing_metric_value(self):
        metric = FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='net_profit',
            value=Decimal('-1200.00'),
            currency='INR',
            is_manual=True,
            created_by=self.finance_user,
        )
        response = self.client.patch(
            f'/api/v1/finance/metrics/{metric.id}/',
            {'value': '2500.75', 'currency': 'INR'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data['value']), Decimal('2500.75'))
        self.assertTrue(response.data['is_manual'])
        metric.refresh_from_db()
        self.assertEqual(metric.value, Decimal('2500.75'))
        self.assertEqual(metric.metric_code, 'net_profit')

    def test_patch_rejects_non_numeric_value(self):
        metric = FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='cash',
            value=Decimal('10.00'),
            currency='INR',
            is_manual=True,
        )
        response = self.client.patch(
            f'/api/v1/finance/metrics/{metric.id}/',
            {'value': 'not-a-number'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        metric.refresh_from_db()
        self.assertEqual(metric.value, Decimal('10.00'))

    def test_sales_user_cannot_write_metrics(self):
        self.client.force_authenticate(self.sales_user)
        response = self.client.post(
            '/api/v1/finance/metrics/',
            {
                'financial_period': str(self.period.id),
                'metric_code': 'revenue',
                'value': '1',
                'currency': 'INR',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sales_user_can_read_ops_summary(self):
        from apps.finance.models import PurchaseOrder, PurchaseOrderStatus
        PurchaseOrder.objects.create(
            po_number='PO-TEST-1',
            customer_name='Acme',
            total_value=Decimal('100000'),
            status=PurchaseOrderStatus.ACTIVE,
        )
        self.client.force_authenticate(self.sales_user)
        response = self.client.get('/api/v1/finance/ops/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('po_metrics', response.data)
        self.assertEqual(response.data['po_metrics']['total_po_value'], 100000.0)

    def test_ops_summary_filters_by_date_range(self):
        from apps.finance.models import PurchaseOrder, PurchaseOrderStatus
        PurchaseOrder.objects.create(
            po_number='PO-IN-RANGE',
            customer_name='In range',
            total_value=Decimal('50000'),
            status=PurchaseOrderStatus.ACTIVE,
            po_date=date(2026, 4, 15),
        )
        PurchaseOrder.objects.create(
            po_number='PO-OUT-RANGE',
            customer_name='Out of range',
            total_value=Decimal('90000'),
            status=PurchaseOrderStatus.ACTIVE,
            po_date=date(2025, 1, 10),
        )
        self.client.force_authenticate(self.sales_user)
        response = self.client.get(
            '/api/v1/finance/ops/summary/',
            {'from': '2026-04-01', 'to': '2027-03-31'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['po_metrics']['total_po_value'], 50000.0)
        series = self.client.get(
            '/api/v1/finance/ops/dashboard-series/',
            {'from': '2026-04-01', 'to': '2026-06-30'},
        )
        self.assertEqual(series.status_code, status.HTTP_200_OK)
        months = [row['month'] for row in series.data.get('billing_vs_collections', [])]
        self.assertEqual(months, ['2026-04', '2026-05', '2026-06'])


class MisUploadAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin-mis@test.com',
            name='Admin',
            password='pass12345',
            role=UserRole.ADMIN,
        )
        self.finance_user = User.objects.create_user(
            email='finance-mis@test.com',
            name='Finance',
            password='pass12345',
            role=UserRole.FINANCE,
        )
        self.sales_user = User.objects.create_user(
            email='sales-mis@test.com',
            name='Sales',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.client.force_authenticate(self.admin)

    def test_admin_uploads_xlsx(self):
        from io import BytesIO
        from pathlib import Path
        from tempfile import TemporaryDirectory

        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings
        from openpyxl import Workbook

        workbook = Workbook()
        workbook.active.append(['Sample'])
        buffer = BytesIO()
        workbook.save(buffer)
        uploaded = SimpleUploadedFile('sample-mis.xlsx', buffer.getvalue())
        with TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                response = self.client.post('/api/v1/finance/mis/', {'file': uploaded}, format='multipart')
                self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
                self.assertEqual(response.data['file_name'], 'sample-mis.xlsx')
                self.assertEqual(response.data['file_type'], 'xlsx')
                self.assertGreater(response.data['byte_size'], 0)
                listed = self.client.get('/api/v1/finance/mis/')
                self.assertEqual(listed.data['count'], 1)
                stored = Path(tmp) / response.data['storage_path']
                self.assertTrue(stored.exists())

    def test_rejects_non_xlsx(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        uploaded = SimpleUploadedFile('notes.txt', b'hello')
        response = self.client.post('/api/v1/finance/mis/', {'file': uploaded}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_finance_and_sales_forbidden(self):
        self.client.force_authenticate(self.finance_user)
        self.assertEqual(self.client.get('/api/v1/finance/mis/').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.sales_user)
        self.assertEqual(self.client.get('/api/v1/finance/mis/').status_code, status.HTTP_403_FORBIDDEN)


SAMPLE_MIS = (
    Path(__file__).resolve().parents[3]
    / 'PROJECT_CONTEXT'
    / 'Files'
    / 'Sample data for MIS.xlsx'
)

SAMPLE_MIS_V2 = (
    Path(__file__).resolve().parents[3]
    / 'PROJECT_CONTEXT'
    / 'Files'
    / 'Sample data for MIS v2.xlsx'
)


class MisImportParserTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin-import@test.com',
            name='Admin',
            password='pass12345',
            role=UserRole.ADMIN,
        )
        self.finance_user = User.objects.create_user(
            email='finance-import@test.com',
            name='Finance',
            password='pass12345',
            role=UserRole.FINANCE,
        )

    def test_sample_mis_import_counts_and_idempotent(self):
        self.assertTrue(SAMPLE_MIS.exists(), f'Missing fixture: {SAMPLE_MIS}')
        from apps.finance.mis_import import import_mis_path
        from apps.finance.models import CashflowEntry, Invoice, Payable

        first = import_mis_path(SAMPLE_MIS)
        self.assertEqual(first['errors'], [])
        self.assertEqual(first['invoices']['created'], 7)
        self.assertEqual(first['payables']['created'], 11)
        self.assertEqual(first['cashflow']['created'], 22)
        self.assertEqual(Invoice.objects.count(), 7)
        self.assertEqual(Payable.objects.count(), 11)
        self.assertEqual(CashflowEntry.objects.count(), 22)
        self.assertTrue(
            Payable.objects.filter(tds_amount__gt=0).exists(),
            'Expected at least one payable with TDS from Purchase Register',
        )

        second = import_mis_path(SAMPLE_MIS)
        self.assertEqual(second['errors'], [])
        self.assertEqual(second['invoices']['created'], 0)
        self.assertEqual(second['invoices']['updated'], 7)
        self.assertEqual(second['payables']['updated'], 11)
        self.assertEqual(second['cashflow']['updated'], 22)
        self.assertEqual(Invoice.objects.count(), 7)
        self.assertEqual(Payable.objects.count(), 11)
        self.assertEqual(CashflowEntry.objects.count(), 22)

    def test_bank_match_sets_payable_and_invoice_status(self):
        from apps.finance.mis_import import import_mis_path
        from apps.finance.models import Invoice, InvoiceStatus, Payable, PayableStatus

        import_mis_path(SAMPLE_MIS)

        tarun = Payable.objects.get(vendor='Tarun P S')
        self.assertEqual(tarun.status, PayableStatus.PAID)
        self.assertEqual(tarun.total_amount, Decimal('55037.25'))

        unmatched = Payable.objects.filter(vendor='Platinum Rent A Car(India) Pvt Ltd').first()
        self.assertIsNotNone(unmatched)
        self.assertEqual(unmatched.status, PayableStatus.PENDING)

        savex = Invoice.objects.filter(customer_name__icontains='Savex').first()
        self.assertIsNotNone(savex)
        self.assertEqual(savex.status, InvoiceStatus.SENT)
        self.assertEqual(savex.amount_received, Decimal('0'))

        import_mis_path(SAMPLE_MIS)
        self.assertEqual(Payable.objects.get(vendor='Tarun P S').status, PayableStatus.PAID)
        self.assertEqual(
            Invoice.objects.filter(customer_name__icontains='Savex').first().status,
            InvoiceStatus.SENT,
        )

    def test_bad_sheet_reports_errors(self):
        from io import BytesIO

        from apps.finance.mis_import import import_mis_workbook
        from openpyxl import Workbook

        workbook = Workbook()
        workbook.active.title = 'Not A Ledger'
        workbook.active.append(['Nope'])
        buffer = BytesIO()
        workbook.save(buffer)
        result = import_mis_workbook(buffer.getvalue())
        messages = {row['sheet']: row['message'] for row in result['errors']}
        self.assertIn('Sales Register', messages)
        self.assertIn('Purchase Register', messages)
        self.assertIn('Bank book', messages)

    def test_upload_parses_into_ledgers_and_summary(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings
        from tempfile import TemporaryDirectory

        from apps.finance.models import CashflowEntry, Invoice, Payable

        self.client.force_authenticate(self.admin)
        uploaded = SimpleUploadedFile(
            'Sample data for MIS.xlsx',
            SAMPLE_MIS.read_bytes(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        with TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                response = self.client.post('/api/v1/finance/mis/', {'file': uploaded}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        result = response.data.get('import_result') or {}
        self.assertEqual(result.get('errors'), [])
        self.assertEqual(Invoice.objects.count(), 7)
        self.assertEqual(Payable.objects.count(), 11)
        self.assertEqual(CashflowEntry.objects.count(), 22)

        self.client.force_authenticate(self.finance_user)
        cashflow = self.client.get('/api/v1/finance/ledger/summary/', {'page': 'cashflow'})
        self.assertEqual(cashflow.status_code, status.HTTP_200_OK)
        self.assertGreater(cashflow.data['total_inflow'], 0)
        payables = self.client.get('/api/v1/finance/ledger/summary/', {'page': 'payables'})
        self.assertEqual(payables.status_code, status.HTTP_200_OK)
        self.assertGreater(payables.data['total_payable'], 0)
        invoices = self.client.get('/api/v1/finance/ledger/summary/', {'page': 'invoices'})
        self.assertEqual(invoices.status_code, status.HTTP_200_OK)
        self.assertEqual(invoices.data['count'], 7)
        filtered = self.client.get('/api/v1/finance/cashflow/', {'direction': 'INFLOW'})
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertTrue(all(row['direction'] == 'INFLOW' for row in filtered.data['results']))

    def test_sample_mis_v2_imports_bank_category_column(self):
        self.assertTrue(SAMPLE_MIS_V2.exists(), f'Missing fixture: {SAMPLE_MIS_V2}')
        from apps.finance.mis_import import import_mis_path
        from apps.finance.models import CashflowEntry

        result = import_mis_path(SAMPLE_MIS_V2)
        self.assertEqual(result['errors'], [])
        self.assertGreater(result['cashflow']['created'], 0)

        categories = set(CashflowEntry.objects.values_list('category', flat=True))
        self.assertIn('Salaries', categories)
        self.assertTrue(
            any(name.lower().startswith('customer receipt') for name in categories),
            f'Expected Customer receipt category, got {categories}',
        )
        # Category should come from Excel, not the party name for categorized rows
        salary_row = CashflowEntry.objects.filter(category='Salaries').first()
        self.assertIsNotNone(salary_row)
        self.assertNotEqual(salary_row.category, salary_row.entity)
        self.assertTrue(
            salary_row.entity and 'praveen' in salary_row.entity.lower(),
            f'Expected Particulars/entity to be salary party, got {salary_row.entity!r}',
        )

        fee_row = CashflowEntry.objects.filter(
            category__iexact='Professional fee',
            entity__icontains='Tarun',
        ).first()
        self.assertIsNotNone(fee_row)
        self.assertEqual(fee_row.category, 'Professional fee')
        self.assertIn('Tarun', fee_row.entity)
        self.assertNotEqual(fee_row.category.lower(), fee_row.entity.lower())

        self.client.force_authenticate(self.finance_user)
        summary = self.client.get('/api/v1/finance/ledger/summary/', {'page': 'cashflow'})
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        card_names = {row['category'] for row in summary.data.get('cards', [])}
        self.assertIn('Salaries', card_names)
        self.assertIn('TOTAL (Net)', card_names)
        # Party names must not appear as category card labels
        self.assertFalse(any('tarun' in name.lower() for name in card_names))
        self.assertFalse(any('savex' in name.lower() for name in card_names))

    def test_opening_balance_imported_and_bank_position(self):
        from apps.finance.mis_import import import_mis_path
        from apps.finance.models import CashflowEntry

        fixture = SAMPLE_MIS_V2 if SAMPLE_MIS_V2.exists() else SAMPLE_MIS
        self.assertTrue(fixture.exists(), f'Missing fixture: {fixture}')
        result = import_mis_path(fixture)
        self.assertEqual(result['errors'], [])

        opening = CashflowEntry.objects.filter(sub_category__iexact='Opening').first()
        self.assertIsNotNone(opening)
        self.assertEqual(opening.category, 'Opening Balance')
        self.assertEqual(opening.direction, 'INFLOW')
        self.assertGreater(opening.amount, 0)

        self.client.force_authenticate(self.finance_user)
        response = self.client.get('/api/v1/finance/bank-position/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        ops = response.data['operational']
        self.assertTrue(ops['available'])
        self.assertAlmostEqual(ops['opening'], float(opening.amount), places=2)
        self.assertGreater(ops['revenue_receipts'], 0)
        self.assertGreater(ops['all_outflows'], 0)
        expected_closing = (
            ops['opening']
            + ops['revenue_receipts']
            + ops['transfer_in']
            - ops['all_outflows']
            - ops['transfer_out']
        )
        self.assertAlmostEqual(ops['closing'], expected_closing, places=2)
        self.assertAlmostEqual(response.data['combined_closing'], ops['closing'], places=2)
        self.assertFalse(response.data['seed']['available'])
        self.assertEqual(response.data['seed']['status'], 'awaiting_seed_bank_book')
        if ops['transfer_in'] > 0:
            self.assertAlmostEqual(
                response.data['seed']['transfer_to_ops'],
                ops['transfer_in'],
                places=2,
            )
            self.assertAlmostEqual(response.data['internal_transfer'], ops['transfer_in'], places=2)
