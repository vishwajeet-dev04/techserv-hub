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
