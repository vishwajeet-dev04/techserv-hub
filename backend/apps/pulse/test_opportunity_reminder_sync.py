from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status

from apps.business.models import Company
from apps.pulse.models import (
    Opportunity,
    OpportunityStatus,
    PulseContact,
    Reminder,
    ReminderStatus,
    ReminderType,
)
from apps.pulse.services import pulse_service
from apps.users.models import User, UserRole


class OpportunityDateReminderSyncTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='sync-owner@test.com',
            name='Sync Owner',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.company = Company.objects.create(name='Sync Co')
        self.contact = PulseContact.objects.create(
            name='Sync Contact',
            company=self.company,
            email='sync@test.com',
        )

    def _opp(self, **overrides):
        defaults = {
            'prospect_number': f'PRO-S{Opportunity.objects.count() + 1:03d}',
            'name': 'Sync Deal',
            'company': self.company,
            'contact': self.contact,
            'owner': self.owner,
            'owner_name': self.owner.name,
            'stage': 'Qualify',
            'status': OpportunityStatus.OPEN,
            'currency': 'INR',
            'service_pillar': 'Consulting',
            'sub_category': 'Growth Advisory',
            'follow_up_date': None,
            'expected_close_date': None,
        }
        defaults.update(overrides)
        return Opportunity.objects.create(**defaults)

    def test_stage_change_creates_follow_up_reminder(self):
        opp = self._opp(stage='Commercial')
        due = date.today() + timedelta(days=7)
        pulse_service.update_opportunity(
            opp,
            actor=self.owner,
            stage='Negotiation',
            follow_up_date=due,
            stage_change_note='Moving ahead',
            negotiated_amount='150000',
        )
        rem = Reminder.objects.get(opportunity=opp, reminder_type=ReminderType.FOLLOW_UP)
        self.assertEqual(rem.status, ReminderStatus.PENDING)
        self.assertEqual(rem.due_date, due)
        self.assertEqual(rem.contact_id, self.contact.id)
        self.assertIn(opp.prospect_number, rem.title)

    def test_changing_follow_up_updates_same_pending_reminder(self):
        opp = self._opp(follow_up_date=date.today() + timedelta(days=3))
        pulse_service._sync_opportunity_date_reminders(opp)
        first = Reminder.objects.get(opportunity=opp, reminder_type=ReminderType.FOLLOW_UP, status=ReminderStatus.PENDING)
        new_due = date.today() + timedelta(days=10)
        pulse_service.update_opportunity(opp, follow_up_date=new_due, stage_change_note='Client asked for next week')
        self.assertEqual(
            Reminder.objects.filter(opportunity=opp, reminder_type=ReminderType.FOLLOW_UP, status=ReminderStatus.PENDING).count(),
            1,
        )
        first.refresh_from_db()
        self.assertEqual(first.due_date, new_due)

    def test_clearing_follow_up_marks_pending_done(self):
        opp = self._opp(follow_up_date=date.today() + timedelta(days=3))
        pulse_service._sync_opportunity_date_reminders(opp)
        pulse_service.update_opportunity(opp, follow_up_date=None, stage_change_note='No follow-up needed')
        rem = Reminder.objects.get(opportunity=opp, reminder_type=ReminderType.FOLLOW_UP)
        self.assertEqual(rem.status, ReminderStatus.DONE)

    def test_close_date_creates_close_reminder(self):
        opp = self._opp()
        close = date.today() + timedelta(days=30)
        pulse_service.update_opportunity(opp, expected_close_date=close)
        rem = Reminder.objects.get(opportunity=opp, reminder_type=ReminderType.CLOSE_DATE)
        self.assertEqual(rem.due_date, close)
        self.assertEqual(rem.status, ReminderStatus.PENDING)

    def test_create_opportunity_with_dates_syncs_reminders(self):
        follow = date.today() + timedelta(days=5)
        close = date.today() + timedelta(days=40)
        created = pulse_service.create_opportunity(
            name='Created with dates',
            owner_name=self.owner.name,
            owner_id=self.owner.id,
            contact=self.contact,
            service_pillar='Consulting',
            sub_category='Growth Advisory',
            stage='Prospect',
            expected_amount='1000',
            currency='INR',
            follow_up_date=follow,
            expected_close_date=close,
        )
        self.assertTrue(
            Reminder.objects.filter(
                opportunity=created,
                reminder_type=ReminderType.FOLLOW_UP,
                due_date=follow,
                status=ReminderStatus.PENDING,
            ).exists()
        )
        self.assertTrue(
            Reminder.objects.filter(
                opportunity=created,
                reminder_type=ReminderType.CLOSE_DATE,
                due_date=close,
                status=ReminderStatus.PENDING,
            ).exists()
        )


class OpportunityDateReminderSyncAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='sync-api@test.com',
            name='API Sync',
            password='pass12345',
            role=UserRole.SALES,
        )
        self.client.force_authenticate(self.user)
        company = Company.objects.create(name='API Sync Co')
        self.contact = PulseContact.objects.create(
            name='API Contact',
            company=company,
            email='api@test.com',
        )

    def test_stage_patch_shows_up_in_reminders_list(self):
        create = self.client.post(
            '/api/v1/pulse/opportunities/',
            {
                'name': 'API Deal',
                'contact': str(self.contact.id),
                'owner': str(self.user.id),
                'owner_name': self.user.name,
                'service_pillar': 'Consulting',
                'sub_category': 'Growth Advisory',
                'stage': 'Commercial',
                'expected_amount': '50000',
                'currency': 'INR',
                'expected_close_date': '2026-12-31',
            },
            format='json',
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED, create.data)
        opp_id = create.data['id']
        due = (date.today() + timedelta(days=4)).isoformat()
        patch = self.client.patch(
            f'/api/v1/pulse/opportunities/{opp_id}/',
            {
                'stage': 'Negotiation',
                'follow_up_date': due,
                'stage_note': 'Need follow-up',
                'negotiated_amount': '150000',
            },
            format='json',
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK, patch.data)
        rem = Reminder.objects.filter(
            opportunity_id=opp_id,
            reminder_type=ReminderType.FOLLOW_UP,
            status=ReminderStatus.PENDING,
        ).first()
        self.assertIsNotNone(rem)
        self.assertEqual(rem.due_date.isoformat(), due)

        listed = self.client.get('/api/v1/pulse/reminders/', {'reminder_type': 'FOLLOW_UP'})
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        results = listed.data['results'] if isinstance(listed.data, dict) else listed.data
        matching = [row for row in results if str(row.get('opportunity')) == str(opp_id)]
        self.assertTrue(matching, results)
        self.assertEqual(matching[0]['due_date'], due)
        self.assertEqual(matching[0]['status'], 'PENDING')
