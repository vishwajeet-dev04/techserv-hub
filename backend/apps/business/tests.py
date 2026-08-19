import uuid

from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import Company, CompanyStatus, Contact
from apps.business.services.company_service import get_company
from apps.deals.models import Deal, DealStage
from apps.users.models import User, UserRole


class CompanyDetailAPITests(APITestCase):
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
            company_type='Private',
            industry='Manufacturing',
            location='Chennai',
            status=CompanyStatus.CUSTOMER,
            owner=self.user,
            notes='Key account',
        )
        self.contact = Contact.objects.create(
            company=self.company,
            first_name='Ada',
            last_name='Lovelace',
            designation='CTO',
            email='ada@acme.com',
        )
        self.deal = Deal.objects.create(
            company=self.company,
            name='ERP rollout',
            value=1500000,
            stage=DealStage.PROPOSAL,
            probability=60,
            owner=self.user,
        )

    def test_get_company_service_returns_contacts(self):
        company = get_company(self.company.id)
        self.assertEqual(company.name, 'Acme Corp')
        self.assertEqual(company.contacts.count(), 1)

    def test_retrieve_company_includes_contacts_and_owner(self):
        response = self.client.get(f'/api/v1/companies/{self.company.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Acme Corp')
        self.assertEqual(response.data['status'], CompanyStatus.CUSTOMER)
        self.assertEqual(response.data['owner']['name'], 'Sales User')
        self.assertEqual(len(response.data['contacts']), 1)
        self.assertEqual(response.data['contacts'][0]['full_name'], 'Ada Lovelace')

    def test_retrieve_missing_company_returns_404(self):
        response = self.client.get(f'/api/v1/companies/{uuid.uuid4()}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(response.data['error'])

    def test_list_deals_filtered_by_company(self):
        other = Company.objects.create(name='Other Co', status=CompanyStatus.PROSPECT)
        Deal.objects.create(
            company=other,
            name='Should not appear',
            value=100,
            stage=DealStage.LEAD,
        )
        response = self.client.get('/api/v1/deals/', {'company_id': str(self.company.id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item['name'] for item in response.data['results']]
        self.assertEqual(names, ['ERP rollout'])

    def test_create_nested_contact(self):
        response = self.client.post(
            f'/api/v1/companies/{self.company.id}/contacts/',
            {
                'first_name': 'Alan',
                'last_name': 'Turing',
                'email': 'alan@acme.com',
                'designation': 'Advisor',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['full_name'], 'Alan Turing')
        self.assertEqual(str(response.data['company']), str(self.company.id))
        self.assertTrue(
            Contact.objects.filter(company=self.company, email='alan@acme.com').exists()
        )

    def test_unauthenticated_company_detail_is_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/v1/companies/{self.company.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
