from datetime import date
from decimal import Decimal

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

