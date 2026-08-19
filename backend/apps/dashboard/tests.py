from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import Company, CompanyStatus
from apps.dashboard.services.alert_service import get_management_alerts
from apps.deals.models import Deal, DealActivity, DealActivityType, DealStage
from apps.finance.models import FinancialMetric, FinancialPeriod, PeriodType
from apps.finance.services.kpi_service import monthly_revenue_equivalent
from apps.users.models import User, UserRole


class ManagementAlertsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='mgmt@test.com',
            name='Mgmt',
            password='pass12345',
            role=UserRole.MANAGEMENT,
        )
        self.client.force_authenticate(self.user)
        self.company = Company.objects.create(
            name='Acme Corp',
            status=CompanyStatus.CUSTOMER,
            owner=self.user,
        )
        self.today = timezone.now().date()
        self.period = FinancialPeriod.objects.create(
            period_type=PeriodType.MONTHLY,
            start_date=date(self.today.year, self.today.month, 1),
            end_date=self.today,
            label='Test Period',
        )

    def _deal(self, name, **kwargs):
        defaults = {
            'company': self.company,
            'name': name,
            'value': Decimal('100000'),
            'stage': DealStage.PROPOSAL,
            'probability': 60,
            'owner': self.user,
        }
        defaults.update(kwargs)
        return Deal.objects.create(**defaults)

    def test_monthly_revenue_equivalent(self):
        self.assertEqual(
            monthly_revenue_equivalent(self.period, Decimal('120')),
            Decimal('120'),
        )
        self.period.period_type = PeriodType.QUARTERLY
        self.assertEqual(
            monthly_revenue_equivalent(self.period, Decimal('90')),
            Decimal('30'),
        )
        self.period.period_type = PeriodType.ANNUAL
        self.assertEqual(
            monthly_revenue_equivalent(self.period, Decimal('120')),
            Decimal('10'),
        )

    def test_no_alerts_when_healthy(self):
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='revenue',
            value=Decimal('1000000'),
            is_manual=True,
        )
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='receivables',
            value=Decimal('100000'),
            is_manual=True,
        )
        deal = self._deal(
            'Healthy deal',
            value=Decimal('1000000'),
            probability=60,
            expected_close_date=self.today + timedelta(days=20),
        )
        DealActivity.objects.create(
            deal=deal,
            type=DealActivityType.CALL,
            subject='Recent call',
            activity_date=self.today,
            created_by=self.user,
        )
        result = get_management_alerts()
        types = [item['type'] for item in result['alerts']]
        self.assertNotIn('overdue_deals', types)
        self.assertNotIn('deals_closing_soon', types)
        self.assertNotIn('high_receivables', types)
        self.assertNotIn('pipeline_health', types)
        self.assertNotIn('deals_no_activity', types)

    def test_overdue_and_closing_soon_alerts(self):
        self._deal('Overdue', expected_close_date=self.today - timedelta(days=4))
        self._deal('Closing', expected_close_date=self.today + timedelta(days=3))
        result = get_management_alerts()
        by_type = {item['type']: item for item in result['alerts']}
        self.assertEqual(by_type['overdue_deals']['severity'], 'critical')
        self.assertEqual(by_type['overdue_deals']['count'], 1)
        self.assertEqual(by_type['overdue_deals']['data'][0]['days_overdue'], 4)
        self.assertEqual(by_type['deals_closing_soon']['severity'], 'warning')
        self.assertEqual(by_type['deals_closing_soon']['count'], 1)

    def test_no_activity_is_warning_then_critical(self):
        self._deal('Stale 1', expected_close_date=self.today + timedelta(days=40))
        result = get_management_alerts()
        by_type = {item['type']: item for item in result['alerts']}
        self.assertEqual(by_type['deals_no_activity']['severity'], 'warning')

        for i in range(5):
            self._deal(f'Stale {i + 2}', expected_close_date=self.today + timedelta(days=40))
        result = get_management_alerts()
        by_type = {item['type']: item for item in result['alerts']}
        self.assertEqual(by_type['deals_no_activity']['count'], 6)
        self.assertEqual(by_type['deals_no_activity']['severity'], 'critical')

    def test_high_receivables_warning_and_critical(self):
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='revenue',
            value=Decimal('1000'),
            is_manual=True,
        )
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='receivables',
            value=Decimal('250'),
            is_manual=True,
        )
        result = get_management_alerts()
        alert = next(item for item in result['alerts'] if item['type'] == 'high_receivables')
        self.assertEqual(alert['severity'], 'warning')
        self.assertEqual(alert['data'][0]['percentage'], 25.0)

        FinancialMetric.objects.filter(metric_code='receivables').update(value=Decimal('400'))
        result = get_management_alerts()
        alert = next(item for item in result['alerts'] if item['type'] == 'high_receivables')
        self.assertEqual(alert['severity'], 'critical')

    def test_pipeline_health_warning(self):
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='revenue',
            value=Decimal('1000000'),
            is_manual=True,
        )
        self._deal(
            'Small pipeline',
            value=Decimal('10000'),
            probability=10,
            expected_close_date=self.today + timedelta(days=40),
        )
        result = get_management_alerts()
        alert = next(item for item in result['alerts'] if item['type'] == 'pipeline_health')
        self.assertEqual(alert['severity'], 'warning')
        self.assertLess(alert['data'][0]['ratio'], 0.5)

    def test_alerts_api_and_summary_fields(self):
        self._deal('Overdue', expected_close_date=self.today - timedelta(days=2))
        alerts_response = self.client.get('/api/v1/dashboard/alerts/')
        self.assertEqual(alerts_response.status_code, status.HTTP_200_OK)
        self.assertIn('alerts', alerts_response.data)
        self.assertGreaterEqual(alerts_response.data['total_alerts'], 1)

        summary = self.client.get('/api/v1/dashboard/')
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data['overdue_deals_count'], 1)
        self.assertEqual(summary.data['deals_closing_this_week'], 0)
        self.assertEqual(summary.data['active_deals_count'], 1)
        self.assertEqual(summary.data['latest_period'], 'Test Period')
        self.assertEqual(summary.data['period'], 'Test Period')
