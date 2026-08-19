from datetime import date
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import Company, CompanyStatus
from apps.deals.models import Deal, DealStage
from apps.deals.services.deal_service import get_pipeline_summary
from apps.finance.models import FinancialMetric, FinancialPeriod, PeriodType
from apps.finance.services.kpi_service import get_financial_dashboard_summary
from apps.users.models import User, UserRole


class ReportAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='reports@test.com',
            name='Report User',
            password='pass12345',
            role=UserRole.MANAGEMENT,
        )
        self.owner_two = User.objects.create_user(
            email='sales@test.com',
            name='Sales Two',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.client.force_authenticate(self.user)
        self.acme = Company.objects.create(
            name='Acme Corp',
            status=CompanyStatus.CUSTOMER,
            owner=self.user,
        )
        self.beta = Company.objects.create(
            name='Beta Ltd',
            status=CompanyStatus.PROSPECT,
            owner=self.user,
        )
        self.period = FinancialPeriod.objects.create(
            period_type=PeriodType.MONTHLY,
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 31),
            label='Aug 2026',
        )
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='revenue',
            value=Decimal('5000000'),
            is_manual=True,
        )
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='net_profit',
            value=Decimal('550000'),
            is_manual=True,
        )
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='receivables',
            value=Decimal('1000000'),
            is_manual=True,
        )
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='liabilities',
            value=Decimal('200000'),
            is_manual=True,
        )
        FinancialMetric.objects.create(
            financial_period=self.period,
            metric_code='equity',
            value=Decimal('800000'),
            is_manual=True,
        )
        Deal.objects.create(
            company=self.acme,
            name='ERP rollout',
            value=Decimal('2000000'),
            stage=DealStage.PROPOSAL,
            probability=60,
            owner=self.user,
        )
        Deal.objects.create(
            company=self.acme,
            name='Support renewal',
            value=Decimal('1000000'),
            stage=DealStage.WON,
            probability=100,
            owner=self.user,
        )
        Deal.objects.create(
            company=self.beta,
            name='Discovery',
            value=Decimal('1000000'),
            stage=DealStage.LEAD,
            probability=10,
            owner=self.owner_two,
        )

    def test_monthly_summary_uses_existing_kpi_services(self):
        response = self.client.get('/api/v1/reports/monthly-summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        pipeline = get_pipeline_summary()
        financial = get_financial_dashboard_summary(self.period.id)
        self.assertEqual(data['report_type'], 'monthly_summary')
        self.assertEqual(data['period'], 'Aug 2026')
        self.assertEqual(data['financial']['revenue'], financial['revenue'])
        self.assertEqual(data['financial']['profit_margin'], financial['profit_margin'])
        self.assertEqual(data['pipeline']['total_pipeline'], pipeline['total_pipeline'])
        self.assertEqual(data['pipeline']['active_deals_count'], pipeline['active_deals_count'])
        self.assertEqual(data['business']['total'], 2)
        self.assertTrue(data['generated_at'])
        self.assertEqual(len(data['highlights']), 4)
        self.assertIn('Revenue: ₹50L for Aug 2026', data['highlights'])
        self.assertIn('Active Deals: 2', data['highlights'])
        self.assertEqual(data['available_periods'][0]['label'], 'Aug 2026')

    def test_monthly_summary_unknown_period_returns_404(self):
        response = self.client.get(
            '/api/v1/reports/monthly-summary/',
            {'period_id': '11111111-1111-1111-1111-111111111111'},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_sales_pipeline_groups_active_deals(self):
        response = self.client.get('/api/v1/reports/sales-pipeline/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['report_type'], 'sales_pipeline')
        self.assertEqual(len(data['deals']), 2)
        self.assertEqual(data['summary']['active_deals_count'], 2)
        owner_names = {row['owner_name'] for row in data['by_owner']}
        self.assertEqual(owner_names, {'Report User', 'Sales Two'})
        company_names = {row['company_name'] for row in data['by_company']}
        self.assertEqual(company_names, {'Acme Corp', 'Beta Ltd'})
        stages = {row['stage'] for row in data['by_stage']}
        self.assertIn(DealStage.PROPOSAL, stages)
        self.assertIn(DealStage.LEAD, stages)

    def test_financial_summary_ratios(self):
        response = self.client.get(
            '/api/v1/reports/financial-summary/',
            {'period_id': str(self.period.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['report_type'], 'financial_summary')
        self.assertEqual(data['metrics']['revenue'], 5000000.0)
        self.assertEqual(data['ratios']['profit_margin'], 11.0)
        self.assertEqual(data['ratios']['receivables_to_revenue'], 0.2)
        self.assertEqual(data['ratios']['debt_to_equity'], 0.25)
        self.assertEqual(data['all_periods'][0]['period'], 'Aug 2026')

    def test_customer_revenue_concentration(self):
        response = self.client.get('/api/v1/reports/customer-revenue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['report_type'], 'customer_revenue')
        acme = next(row for row in data['companies'] if row['company_name'] == 'Acme Corp')
        self.assertEqual(acme['deal_count'], 2)
        self.assertEqual(acme['total_deal_value'], 3000000.0)
        self.assertEqual(acme['won_deal_value'], 1000000.0)
        self.assertEqual(acme['active_deal_value'], 2000000.0)
        self.assertEqual(data['top_customers'][0]['company_name'], 'Acme Corp')
        self.assertEqual(data['concentration_risk']['top_customer_percentage'], 75.0)
        self.assertTrue(data['concentration_risk']['is_concentrated'])

    def test_unauthenticated_reports_are_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/v1/reports/monthly-summary/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
