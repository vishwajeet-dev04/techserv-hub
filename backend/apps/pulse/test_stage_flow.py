from datetime import date, timedelta

from django.test import TestCase
from rest_framework import status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.test import APITestCase

from apps.business.models import Company
from apps.pulse.constants import allowed_next_stages
from apps.pulse.models import (
    Opportunity,
    OpportunityActivity,
    OpportunityActivityAction,
    OpportunityStatus,
    PulseContact,
)
from apps.pulse.services import pulse_service
from apps.users.models import User, UserRole


class AllowedNextStagesTests(TestCase):
    def test_forward_only_plus_terminal(self):
        self.assertEqual(
            allowed_next_stages('Demo'),
            ['Commercial', 'Negotiation', 'Win', 'Lost', 'Cancelled'],
        )
        self.assertNotIn('Prospect', allowed_next_stages('Qualify'))

    def test_terminal_has_no_next(self):
        for stage in ('Win', 'Lost', 'Cancelled'):
            self.assertEqual(allowed_next_stages(stage), [])


class StageFlowServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='flow-owner@test.com',
            name='Flow Owner',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.company = Company.objects.create(name='Flow Co')
        self.contact = PulseContact.objects.create(name='Flow Contact', company=self.company, email='flow@test.com')

    def _opp(self, stage='Demo', **overrides):
        defaults = {
            'prospect_number': f'PRO-F{Opportunity.objects.count() + 1:03d}',
            'name': 'Flow Deal',
            'company': self.company,
            'contact': self.contact,
            'owner': self.owner,
            'owner_name': self.owner.name,
            'stage': stage,
            'status': OpportunityStatus.OPEN,
            'currency': 'INR',
            'service_pillar': 'Consulting',
            'sub_category': 'Growth Advisory',
            'follow_up_date': date.today() + timedelta(days=2),
        }
        defaults.update(overrides)
        return Opportunity.objects.create(**defaults)

    def test_forward_jump_allowed(self):
        opp = self._opp(stage='Qualify')
        saved = pulse_service.update_opportunity(
            opp, actor=self.owner, stage='Commercial', stage_change_note='Skipped demo',
        )
        self.assertEqual(saved.stage, 'Commercial')

    def test_backward_move_rejected(self):
        opp = self._opp(stage='Commercial')
        with self.assertRaises(DrfValidationError) as ctx:
            pulse_service.update_opportunity(opp, stage='Demo', stage_change_note='Go back')
        self.assertIn('stage', ctx.exception.detail)
        opp.refresh_from_db()
        self.assertEqual(opp.stage, 'Commercial')

    def test_terminal_stage_locked(self):
        opp = self._opp(stage='Lost', status=OpportunityStatus.LOST)
        with self.assertRaises(DrfValidationError):
            pulse_service.update_opportunity(opp, stage='Negotiation', stage_change_note='Revive')
        with self.assertRaises(DrfValidationError) as ctx:
            pulse_service.update_opportunity(
                opp, follow_up_date=date.today() + timedelta(days=9), stage_change_note='Chase',
            )
        self.assertIn('follow_up_date', ctx.exception.detail)

    def test_follow_up_extension_logs_activity(self):
        opp = self._opp(stage='Demo')
        new_date = date.today() + timedelta(days=10)
        pulse_service.update_opportunity(
            opp, actor=self.owner, follow_up_date=new_date, stage_change_note='Client travelling',
        )
        activity = OpportunityActivity.objects.get(opportunity=opp)
        self.assertEqual(activity.action, OpportunityActivityAction.FOLLOW_UP_CHANGE)
        self.assertEqual(activity.from_stage, 'Demo')
        self.assertEqual(activity.to_stage, 'Demo')
        self.assertEqual(activity.follow_up_date, new_date)
        self.assertEqual(activity.note, 'Client travelling')

    def test_follow_up_change_requires_note(self):
        opp = self._opp(stage='Demo')
        with self.assertRaises(DrfValidationError) as ctx:
            pulse_service.update_opportunity(opp, follow_up_date=date.today() + timedelta(days=10))
        self.assertIn('stage_note', ctx.exception.detail)
        self.assertFalse(OpportunityActivity.objects.exists())

    def test_unchanged_follow_up_needs_no_note(self):
        opp = self._opp(stage='Demo')
        pulse_service.update_opportunity(opp, follow_up_date=opp.follow_up_date, department='Sales')
        self.assertFalse(OpportunityActivity.objects.exists())


class StageFlowAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='flow-api@test.com',
            name='Flow API',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.client.force_authenticate(self.user)
        company = Company.objects.create(name='Flow API Co')
        contact = PulseContact.objects.create(name='Flow API Contact', company=company, email='flowapi@test.com')
        self.opp = Opportunity.objects.create(
            prospect_number='PRO-FAPI',
            name='API Flow Deal',
            company=company,
            contact=contact,
            owner=self.user,
            owner_name=self.user.name,
            stage='Commercial',
            status=OpportunityStatus.OPEN,
            currency='INR',
            service_pillar='Consulting',
            sub_category='Growth Advisory',
            follow_up_date=date.today() + timedelta(days=1),
        )

    def test_backward_patch_returns_400_envelope(self):
        response = self.client.patch(
            f'/api/v1/pulse/opportunities/{self.opp.id}/',
            {'stage': 'Approach', 'stage_note': 'Oops', 'follow_up_date': '2026-12-01'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data.get('error'))

    def test_follow_up_patch_shows_in_activities(self):
        new_date = (date.today() + timedelta(days=7)).isoformat()
        response = self.client.patch(
            f'/api/v1/pulse/opportunities/{self.opp.id}/',
            {'follow_up_date': new_date, 'stage_note': 'Pushed to next week'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        activities = self.client.get(f'/api/v1/pulse/opportunities/{self.opp.id}/activities/')
        self.assertEqual(activities.status_code, status.HTTP_200_OK)
        self.assertEqual(activities.data[0]['action'], 'FOLLOW_UP_CHANGE')
        self.assertEqual(activities.data[0]['follow_up_date'], new_date)
