from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User, UserRole

STRONG_PASSWORD = 'Harbour-Lantern-482'


class UserAdminAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@test.com', name='Admin User', password='pass12345', role=UserRole.ADMIN,
        )
        self.sales = User.objects.create_user(
            email='sales@test.com', name='Sales Person', password='pass12345', role=UserRole.SALES,
        )
        self.client.force_authenticate(self.admin)

    def _ids(self, response):
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        return {row['id'] for row in rows}

    def test_non_admin_cannot_manage_users(self):
        self.client.force_authenticate(self.sales)
        self.assertEqual(self.client.get('/api/v1/users/').status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(
            f'/api/v1/users/{self.admin.id}/set-password/', {'new_password': STRONG_PASSWORD}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_status_filter_and_reactivate(self):
        self.client.delete(f'/api/v1/users/{self.sales.id}/')
        self.sales.refresh_from_db()
        self.assertFalse(self.sales.is_active)
        active = self.client.get('/api/v1/users/?status=active')
        inactive = self.client.get('/api/v1/users/?status=inactive')
        everyone = self.client.get('/api/v1/users/')
        self.assertNotIn(str(self.sales.id), self._ids(active))
        self.assertEqual(self._ids(inactive), {str(self.sales.id)})
        self.assertEqual(len(self._ids(everyone)), 2)
        response = self.client.patch(f'/api/v1/users/{self.sales.id}/', {'is_active': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.sales.refresh_from_db()
        self.assertTrue(self.sales.is_active)

    def test_admin_can_edit_role_and_name(self):
        response = self.client.patch(
            f'/api/v1/users/{self.sales.id}/', {'role': UserRole.FINANCE, 'name': 'Finance Person'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.sales.refresh_from_db()
        self.assertEqual(self.sales.role, UserRole.FINANCE)
        self.assertEqual(self.sales.name, 'Finance Person')

    def test_admin_cannot_demote_or_deactivate_self(self):
        demote = self.client.patch(f'/api/v1/users/{self.admin.id}/', {'role': UserRole.SALES}, format='json')
        self.assertEqual(demote.status_code, status.HTTP_400_BAD_REQUEST)
        deactivate = self.client.delete(f'/api/v1/users/{self.admin.id}/')
        self.assertEqual(deactivate.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role, UserRole.ADMIN)
        self.assertTrue(self.admin.is_active)

    def test_last_admin_guard(self):
        other = User.objects.create_user(
            email='other@test.com', name='Other Admin', password='pass12345', role=UserRole.ADMIN,
        )
        demote_other = self.client.patch(f'/api/v1/users/{other.id}/', {'role': UserRole.SALES}, format='json')
        self.assertEqual(demote_other.status_code, status.HTTP_200_OK, demote_other.data)

        from apps.users.serializers import UserSerializer

        serializer = UserSerializer(instance=self.admin, data={'is_active': False}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('is_active', serializer.errors)

    def test_set_password_validates_and_revokes_sessions(self):
        refresh = RefreshToken.for_user(self.sales)
        weak = self.client.post(
            f'/api/v1/users/{self.sales.id}/set-password/', {'new_password': 'password'}, format='json',
        )
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            f'/api/v1/users/{self.sales.id}/set-password/', {'new_password': STRONG_PASSWORD}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.sales.refresh_from_db()
        self.assertTrue(self.sales.check_password(STRONG_PASSWORD))
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=refresh['jti']).exists())
        self.client.force_authenticate(None)
        refreshed = self.client.post('/api/v1/auth/refresh/', {'refresh': str(refresh)}, format='json')
        self.assertEqual(refreshed.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_user_rejects_common_password(self):
        response = self.client.post('/api/v1/users/', {
            'name': 'New Person', 'email': 'new@test.com', 'password': 'password123', 'role': UserRole.SALES,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data['details'])

    def test_create_user_links_unassigned_opportunities(self):
        from apps.pulse.models import Opportunity
        from apps.pulse.services import pulse_service

        contact = pulse_service.create_contact(
            company_name='Link Co', name='Link Contact', strict=False,
        )
        opportunity = pulse_service.opportunities.create(
            prospect_number='PRO-900', name='Imported Deal', owner_name='Ravi  kumar', owner=None,
            company=contact.company, contact=contact, service_pillar='Consulting', sub_category='Resources',
            stage='Prospect Qualification', status='OPEN', expected_amount=1000, currency='INR',
        )
        response = self.client.post('/api/v1/users/', {
            'name': 'Ravi Kumar', 'email': 'ravi@test.com', 'password': STRONG_PASSWORD, 'role': UserRole.SALES,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        opportunity.refresh_from_db()
        self.assertEqual(opportunity.owner.email, 'ravi@test.com')
        self.assertEqual(opportunity.owner_name, 'Ravi Kumar')
