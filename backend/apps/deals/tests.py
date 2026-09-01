import uuid
from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import Company, CompanyStatus
from apps.deals.models import Deal, DealActivity, DealActivityType, DealStage
from apps.deals.services.deal_service import get_deal, set_default_probability
from apps.users.models import User, UserRole


class DealDetailAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='sales@test.com',
            name='Sales User',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.client.force_authenticate(self.user)
        self.company = Company.objects.create(
            name='Acme Corp',
            status=CompanyStatus.CUSTOMER,
            owner=self.user,
        )
        self.deal = Deal.objects.create(
            company=self.company,
            name='ERP rollout',
            description='Implementation',
            value=1500000,
            stage=DealStage.PROPOSAL,
            probability=60,
            owner=self.user,
            source='Referral',
            notes='Priority account',
            expected_close_date=date(2026, 9, 30),
        )
        self.activity = DealActivity.objects.create(
            deal=self.deal,
            type=DealActivityType.CALL,
            subject='Discovery call',
            description='Covered requirements',
            activity_date=date(2026, 8, 1),
            created_by=self.user,
        )

    def test_get_deal_service_includes_company_and_activities(self):
        deal = get_deal(self.deal.id)
        self.assertEqual(deal.company.name, 'Acme Corp')
        self.assertEqual(deal.activities.count(), 1)

    def test_retrieve_deal_includes_activities_and_weighted_value(self):
        response = self.client.get(f'/api/v1/deals/{self.deal.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'ERP rollout')
        self.assertEqual(response.data['company_name'], 'Acme Corp')
        self.assertEqual(response.data['stage'], DealStage.PROPOSAL)
        self.assertEqual(float(response.data['weighted_value']), 900000.0)
        self.assertEqual(len(response.data['activities']), 1)
        self.assertEqual(response.data['activities'][0]['subject'], 'Discovery call')

    def test_retrieve_missing_deal_returns_404(self):
        response = self.client.get(f'/api/v1/deals/{uuid.uuid4()}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(response.data['error'])

    def test_patch_stage_sets_default_probability(self):
        response = self.client.patch(
            f'/api/v1/deals/{self.deal.id}/',
            {'stage': DealStage.NEGOTIATION},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stage'], DealStage.NEGOTIATION)
        self.assertEqual(response.data['probability'], set_default_probability(DealStage.NEGOTIATION))
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.stage, DealStage.NEGOTIATION)

    def test_list_activities_for_deal(self):
        response = self.client.get(f'/api/v1/deals/{self.deal.id}/activities/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['type'], DealActivityType.CALL)

    def test_create_activity(self):
        response = self.client.post(
            f'/api/v1/deals/{self.deal.id}/activities/',
            {
                'type': DealActivityType.MEETING,
                'subject': 'Proposal review',
                'description': 'Walked through scope',
                'activity_date': '2026-08-19',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['subject'], 'Proposal review')
        self.assertEqual(response.data['created_by_name'], 'Sales User')
        self.assertTrue(
            DealActivity.objects.filter(deal=self.deal, subject='Proposal review').exists()
        )

    def test_unauthenticated_deal_detail_is_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/v1/deals/{self.deal.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pipeline_summary_includes_pillar_and_funnel(self):
        self.deal.service_pillar = 'Marketing'
        self.deal.sub_category = 'ICP/ABM'
        self.deal.source = 'Services & Product'
        self.deal.save()
        Deal.objects.create(
            company=self.company,
            name='Won deal',
            value=500000,
            stage=DealStage.WON,
            probability=100,
            owner=self.user,
            service_pillar='Consulting',
            source='Services & Product',
        )
        Deal.objects.create(
            company=self.company,
            name='Lost deal',
            value=200000,
            stage=DealStage.LOST,
            probability=0,
            owner=self.user,
            service_pillar='Marketing',
            source='Software & AI',
        )
        response = self.client.get('/api/v1/deals/pipeline/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['active_deals_count'], 1)
        self.assertEqual(data['won_count'], 1)
        self.assertEqual(data['lost_count'], 1)
        self.assertEqual(data['win_rate'], 50.0)
        pillars = {row['name']: row for row in data['by_pillar']}
        self.assertEqual(pillars['Marketing']['count'], 2)
        self.assertEqual(pillars['Consulting']['won_count'], 1)
        funnel_stages = {row['stage'] for row in data['funnel']}
        self.assertIn(DealStage.PROPOSAL, funnel_stages)
        self.assertIn(DealStage.WON, funnel_stages)
        self.assertIn(DealStage.LOST, funnel_stages)

    def test_list_deals_filter_by_service_pillar(self):
        self.deal.service_pillar = 'Marketing'
        self.deal.save()
        response = self.client.get('/api/v1/deals/', {'service_pillar': 'Marketing'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item['name'] for item in response.data['results']]
        self.assertEqual(names, ['ERP rollout'])
        self.assertEqual(response.data['results'][0]['service_pillar'], 'Marketing')


class FunnelSheetMappingTests(APITestCase):
    def test_status_maps_to_pipeline_stages(self):
        from apps.deals.management.commands.seed_funnel import map_stage, parse_probability, parse_value

        self.assertEqual(map_stage('Closed - PO received but project not executed'), DealStage.WON)
        self.assertEqual(map_stage('Lost to Wizard.io'), DealStage.LOST)
        self.assertEqual(map_stage('Proposal sent to Kush'), DealStage.PROPOSAL)
        self.assertEqual(map_stage('KickOff Today'), DealStage.WON)
        self.assertEqual(map_stage('Warm - Discussions Open'), DealStage.LEAD)

        value, currency = parse_value('350000/month')
        self.assertEqual(value, 4200000)
        self.assertEqual(currency, 'INR')
        self.assertEqual(parse_probability(0.7, DealStage.PROPOSAL), 70)


