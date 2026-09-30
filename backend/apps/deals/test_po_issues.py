import importlib
import shutil
import tempfile
from datetime import date, timedelta
from io import BytesIO
from unittest import mock

from django.apps import apps as global_apps
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import Company
from apps.deals.models import PoDocumentIssue, PoDocumentIssueStatus, PoWorkflow
from apps.deals.po_issue_emails import issue_recipients, send_po_issue_email
from apps.pulse.models import (
    Opportunity,
    OpportunityActivity,
    OpportunityActivityAction,
    OpportunityActivityAttachment,
    OpportunityStatus,
    PulseContact,
)
from apps.users.models import User, UserRole

MEDIA = tempfile.mkdtemp(prefix='po-issue-tests-')


def _broker_down(*args, **kwargs):
    raise ConnectionError('broker unavailable')


@override_settings(
    MEDIA_ROOT=MEDIA,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    FRONTEND_URL='http://hub.test',
)
class PoIssueFlowTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user(email='admin@po.test', name='Admin', password='x', role=UserRole.ADMIN)
        self.mgmt = User.objects.create_user(email='mgmt@po.test', name='Mgmt', password='x', role=UserRole.MANAGEMENT)
        self.owner = User.objects.create_user(email='owner@po.test', name='Owner', password='x', role=UserRole.SALES)
        self.ops = User.objects.create_user(email='ops@po.test', name='Ops', password='x', role=UserRole.SALES)
        User.objects.create_user(email='fin@po.test', name='Fin', password='x', role=UserRole.FINANCE)
        User.objects.create_user(
            email='gone@po.test', name='Gone', password='x', role=UserRole.ADMIN, is_active=False,
        )
        company = Company.objects.create(name='Issue Co')
        contact = PulseContact.objects.create(name='Buyer', company=company, email='buyer@issue.test')
        self.opp = Opportunity.objects.create(
            prospect_number='PRO-I001',
            name='Issue Deal',
            company=company,
            contact=contact,
            owner=self.owner,
            owner_name=self.owner.name,
            stage='Win',
            status=OpportunityStatus.WON,
            currency='INR',
            service_pillar='Consulting',
            sub_category='Growth Advisory',
            follow_up_date=date.today() + timedelta(days=3),
        )
        win = OpportunityActivity.objects.create(
            opportunity=self.opp,
            actor=self.owner,
            action=OpportunityActivityAction.STAGE_CHANGE,
            from_stage='Negotiation',
            to_stage='Win',
            note='Won',
        )
        self.doc = OpportunityActivityAttachment.objects.create(
            activity=win,
            file=SimpleUploadedFile('old-po.pdf', b'%PDF-1.4 old'),
            file_name='old-po.pdf',
            uploaded_by=self.owner,
        )
        self.client.force_authenticate(self.ops)

    def _raise(self, **overrides):
        payload = {
            'opportunity': str(self.opp.id),
            'reasons': ['WRONG_DOCUMENT'],
            'attachment_ids': [str(self.doc.id)],
            'note': 'This is last year PO',
        }
        payload.update(overrides)
        with mock.patch('apps.deals.tasks.send_po_issue_email_task.apply_async', side_effect=_broker_down):
            with self.captureOnCommitCallbacks(execute=True):
                return self.client.post('/api/v1/deals/po-issues/', payload, format='json')

    def test_raise_issue_emails_admin_management_and_owner(self):
        response = self._raise()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], 'OPEN')
        self.assertEqual(response.data['reason_labels'], ['Wrong document uploaded'])
        self.assertEqual(response.data['attachments'][0]['file_name'], 'old-po.pdf')
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(sorted(message.to), ['admin@po.test', 'mgmt@po.test', 'owner@po.test'])
        self.assertIn('PRO-I001', message.subject)
        self.assertIn('old-po.pdf', message.body)
        self.assertIn('Upload corrected documents', message.body)
        self.assertIsNotNone(PoDocumentIssue.objects.get().email_sent_at)

    def test_email_task_sends_once(self):
        self._raise()
        issue = PoDocumentIssue.objects.get()
        self.assertFalse(send_po_issue_email(issue.id))
        self.assertEqual(len(mail.outbox), 1)

    def test_queued_when_broker_available(self):
        with mock.patch('apps.deals.tasks.send_po_issue_email_task.apply_async') as queued:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    '/api/v1/deals/po-issues/',
                    {'opportunity': str(self.opp.id), 'reasons': ['PO_MISSING']},
                    format='json',
                )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        queued.assert_called_once()
        self.assertEqual(len(mail.outbox), 0)

    def test_validation(self):
        self.assertEqual(self._raise(reasons=[]).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._raise(reasons=['NOPE']).status_code, status.HTTP_400_BAD_REQUEST)
        other = self._raise(reasons=['OTHER'], note='')
        self.assertEqual(other.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('note', other.data['details'])

        foreign = Opportunity.objects.create(
            prospect_number='PRO-I002', name='Other', company=self.opp.company, contact=self.opp.contact,
            stage='Win', status=OpportunityStatus.WON, currency='INR',
        )
        foreign_act = OpportunityActivity.objects.create(
            opportunity=foreign, action=OpportunityActivityAction.STAGE_CHANGE, to_stage='Win',
        )
        foreign_doc = OpportunityActivityAttachment.objects.create(
            activity=foreign_act, file=SimpleUploadedFile('x.pdf', b'x'), file_name='x.pdf',
        )
        bad_doc = self._raise(attachment_ids=[str(foreign_doc.id)])
        self.assertEqual(bad_doc.status_code, status.HTTP_400_BAD_REQUEST)

        self.opp.stage = 'Negotiation'
        self.opp.save(update_fields=['stage'])
        self.assertEqual(self._raise().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PoDocumentIssue.objects.count(), 0)

    def test_open_issue_count_on_opportunity(self):
        self._raise()
        listed = self.client.get('/api/v1/pulse/opportunities/', {'stage': 'Win'})
        rows = listed.data['results'] if isinstance(listed.data, dict) else listed.data
        row = next(item for item in rows if item['id'] == str(self.opp.id))
        self.assertEqual(row['open_po_issue_count'], 1)

    def _upload(self, user, *, note='Uploaded signed FY26 PO'):
        self.client.force_authenticate(user)
        with mock.patch(
            'apps.deals.tasks.send_po_issue_resolved_email_task.apply_async', side_effect=_broker_down,
        ):
            with self.captureOnCommitCallbacks(execute=True):
                return self.client.post(
                    f'/api/v1/pulse/opportunities/{self.opp.id}/documents/',
                    {'files': [SimpleUploadedFile('new-po.pdf', b'%PDF-1.4 new')], 'note': note},
                    format='multipart',
                )

    def test_owner_upload_resolves_issue_and_notifies_raiser(self):
        self._raise()
        mail.outbox.clear()
        response = self._upload(self.owner)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['action'], 'DOCUMENT_UPDATE')
        self.assertEqual(response.data['attachments'][0]['file_name'], 'new-po.pdf')
        issue = PoDocumentIssue.objects.get()
        self.assertEqual(issue.status, PoDocumentIssueStatus.RESOLVED)
        self.assertEqual(issue.resolved_by, self.owner)
        self.assertEqual(str(issue.resolution_activity_id), response.data['id'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ops@po.test'])
        self.assertIn('Corrected documents uploaded', mail.outbox[0].subject)

    def test_upload_requires_owner_admin_or_management(self):
        self._raise()
        forbidden = self._upload(self.ops)
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(PoDocumentIssue.objects.get().status, PoDocumentIssueStatus.OPEN)
        self.assertEqual(self._upload(self.mgmt).status_code, status.HTTP_201_CREATED)

    def test_upload_requires_note_and_files(self):
        response = self._upload(self.owner, note='')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_manual_resolve_is_admin_or_management_only(self):
        self._raise()
        issue = PoDocumentIssue.objects.get()
        denied = self.client.post(f'/api/v1/deals/po-issues/{issue.id}/resolve/', {'resolution_note': 'x'}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        ok = self.client.post(
            f'/api/v1/deals/po-issues/{issue.id}/resolve/', {'resolution_note': 'Docs were fine'}, format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        self.assertEqual(ok.data['status'], 'RESOLVED')
        again = self.client.post(f'/api/v1/deals/po-issues/{issue.id}/resolve/', {}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recipients_skip_inactive_and_finance(self):
        self._raise()
        issue = PoDocumentIssue.objects.get()
        self.assertEqual(issue_recipients(issue), ['admin@po.test', 'mgmt@po.test', 'owner@po.test'])

    def test_reasons_endpoint(self):
        response = self.client.get('/api/v1/deals/po-issues/reasons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn({'code': 'OTHER', 'label': 'Other (explain in note)'}, response.data)


class MilestoneBillingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='ms@po.test', name='MS', password='x', role=UserRole.SALES)
        self.client.force_authenticate(self.user)
        self.base = {
            'customer_name': 'Milestone Co',
            'billing_entity': 'India',
            'service_pillar': 'AIDA',
            'po_number': 'PO-MS-1',
            'agreement': 'Yes',
            'billing_due': 'Event Specific',
        }

    def test_milestone_requires_details(self):
        missing = self.client.post(
            '/api/v1/deals/po-workflow/', {**self.base, 'billing_cycle': 'Milestone'}, format='json',
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('milestone_details', missing.data['details'])
        ok = self.client.post(
            '/api/v1/deals/po-workflow/',
            {**self.base, 'billing_cycle': 'Milestone', 'milestone_details': '40% UAT, 60% go-live'},
            format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)
        self.assertEqual(ok.data['milestone_details'], '40% UAT, 60% go-live')

    def test_legacy_event_maps_to_milestone_and_other_cycles_clear_details(self):
        legacy = self.client.post(
            '/api/v1/deals/po-workflow/',
            {**self.base, 'billing_cycle': 'Event', 'milestone_details': 'On delivery'},
            format='json',
        )
        self.assertEqual(legacy.data['billing_cycle'], 'Milestone')
        monthly = self.client.patch(
            f"/api/v1/deals/po-workflow/{legacy.data['id']}/", {'billing_cycle': 'Monthly'}, format='json',
        )
        self.assertEqual(monthly.status_code, status.HTTP_200_OK, monthly.data)
        self.assertEqual(monthly.data['milestone_details'], '')

    def test_excel_accepts_hand_over_date_header(self):
        from openpyxl import Workbook

        from apps.deals.po_constants import PO_WORKFLOW_HEADERS

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'PO_Workflow'
        sheet.append(PO_WORKFLOW_HEADERS)
        row = dict.fromkeys(PO_WORKFLOW_HEADERS, None)
        row.update({
            'Customer': 'Excel Co', 'Billing Entity': 'India', 'Service Pillar': 'AIDA', 'PO Number': 'PO-X',
            'Agreement': 'Yes', 'Hand Over Date': '2026-12-31', 'Billing Cycle': 'Milestone',
            'Milestone Details': 'Phase 1', 'Billing Due': '1st of Month',
        })
        sheet.append([row[header] for header in PO_WORKFLOW_HEADERS])
        buffer = BytesIO()
        workbook.save(buffer)
        result = self.client.post(
            '/api/v1/deals/po-workflow/import/',
            {'file': SimpleUploadedFile('po.xlsx', buffer.getvalue())},
            format='multipart',
        )
        self.assertEqual(result.data['created'], 1, result.data)
        saved = PoWorkflow.objects.get(customer_name='Excel Co')
        self.assertEqual(saved.expiry, date(2026, 12, 31))
        self.assertEqual(saved.milestone_details, 'Phase 1')


class EventToMilestoneMigrationTests(TestCase):
    def test_forward_and_reverse(self):
        migration = importlib.import_module('apps.deals.migrations.0006_milestone_billing')
        company = Company.objects.create(name='Mig Co')
        row = PoWorkflow.objects.create(
            company=company, customer_name='Mig Co', billing_entity='India', service_pillar='AIDA',
            po_number='PO-M', agreement='Yes', billing_cycle='Event', billing_due='1st of Month',
        )
        migration.event_to_milestone(global_apps, None)
        row.refresh_from_db()
        self.assertEqual(row.billing_cycle, 'Milestone')
        migration.milestone_to_event(global_apps, None)
        row.refresh_from_db()
        self.assertEqual(row.billing_cycle, 'Event')
