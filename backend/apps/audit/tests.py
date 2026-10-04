from io import BytesIO, StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from azure.core.exceptions import ResourceExistsError
from django.core.files.storage import FileSystemStorage, storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase
from openpyxl import Workbook
from rest_framework import status
from rest_framework.test import APITestCase

from apps.audit.models import ImportLog, ImportModule
from apps.users.models import User, UserRole


def _pipeline_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Lead - Deal'
    sheet.append([
        'Prospect Number', 'Prospect Name', 'Company name', 'Contact Names',
        'Service Pillar', 'Sub-Categories', 'Expected Amount(₹)', 'Sales Stage', 'Assigned To',
    ])
    sheet.append(['PRO-500', 'Logged Deal', 'Audit Co', 'Asha', 'Consulting', 'Growth Advisory', 1000,
                  'Prospect Qualification', 'Nobody Known'])
    sheet.append(['PRO-501', 'Broken Deal', 'Audit Co', 'Asha', 'Nonsense', 'Growth Advisory', 1000,
                  'Prospect Qualification', 'Nobody Known'])
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


class ImportLogAPITests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email='mgmt@test.com', name='Manager', password='pass12345', role=UserRole.MANAGEMENT,
        )
        self.sales = User.objects.create_user(
            email='sales@test.com', name='Sales', password='pass12345', role=UserRole.SALES,
        )

    def _import(self, user):
        self.client.force_authenticate(user)
        content = _pipeline_bytes()
        return content, self.client.post(
            '/api/v1/pulse/opportunities/import/',
            {'file': SimpleUploadedFile('Q3 pipeline.xlsx', content)},
            format='multipart',
        )

    def test_import_is_recorded_with_counts_and_file(self):
        content, response = self._import(self.sales)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        log = ImportLog.objects.get()
        self.assertEqual(response.data['import_log_id'], str(log.id))
        self.assertEqual(log.module, ImportModule.PULSE_OPPORTUNITIES)
        self.assertEqual(log.file_name, 'Q3 pipeline.xlsx')
        self.assertEqual(log.byte_size, len(content))
        self.assertEqual(log.uploaded_by, self.sales)
        self.assertEqual(log.created_count, 1)
        self.assertEqual(log.error_count, 1)
        self.assertGreaterEqual(log.warning_count, 1)
        self.assertEqual(log.errors[0]['row'], 3)
        self.assertNotIn('pipeline', log.file.name)

    def test_history_endpoints_are_management_only(self):
        self._import(self.sales)
        log = ImportLog.objects.get()
        self.assertEqual(self.client.get('/api/v1/audit/imports/').status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.manager)
        listing = self.client.get('/api/v1/audit/imports/?module=pulse_opportunities')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data['results'][0]['uploaded_by_name'], 'Sales')
        self.assertNotIn('errors', listing.data['results'][0])
        other_module = self.client.get('/api/v1/audit/imports/?module=PO_WORKFLOW')
        self.assertEqual(other_module.data['results'], [])

        detail = self.client.get(f'/api/v1/audit/imports/{log.id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail.data['errors']), 1)

        download = self.client.get(f'/api/v1/audit/imports/{log.id}/file/')
        self.assertEqual(download.status_code, status.HTTP_200_OK)
        self.assertIn('Q3 pipeline.xlsx', download['Content-Disposition'])
        self.assertEqual(b''.join(download.streaming_content)[:2], b'PK')

    def test_missing_original_file_returns_404(self):
        self._import(self.sales)
        log = ImportLog.objects.get()
        log.file.storage.delete(log.file.name)
        self.client.force_authenticate(self.manager)
        response = self.client.get(f'/api/v1/audit/imports/{log.id}/file/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FakeBlob:
    def __init__(self, store, name):
        self.store, self.name = store, name

    def exists(self):
        return self.name in self.store

    def upload_blob(self, data, overwrite, content_settings):
        if self.name in self.store and not overwrite:
            raise ResourceExistsError('exists')
        self.store[self.name] = (data.read(), content_settings.content_type)


class BlobStorageTests(SimpleTestCase):
    def test_tests_use_local_filesystem(self):
        self.assertIsInstance(storages['default'], FileSystemStorage)

    def test_connection_string_supplies_signing_key(self):
        from config.settings.base import _azure_connection_parts

        parts = _azure_connection_parts(
            'DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc==;EndpointSuffix=core.windows.net;'
        )
        self.assertEqual(parts, {'account_name': 'acct', 'account_key': 'abc==', 'endpoint_suffix': 'core.windows.net'})

    def test_blob_commands_require_azure(self):
        with self.assertRaises(CommandError):
            call_command('blob_setup', stdout=StringIO())
        with self.assertRaises(CommandError):
            call_command('copy_media_to_blob', '--dry-run', stdout=StringIO())

    def test_copy_media_keeps_relative_names_and_skips_existing(self):
        store = {'imports/old.xlsx': (b'already', 'x')}
        fake = mock.Mock(location='', azure_container='media-test')
        fake.client.get_blob_client.side_effect = lambda name: FakeBlob(store, name)
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'pulse' / 'opportunity_attachments' / '2026' / '10').mkdir(parents=True)
            (root / 'pulse' / 'opportunity_attachments' / '2026' / '10' / 'deck v2.pdf').write_bytes(b'%PDF')
            (root / 'imports').mkdir()
            (root / 'imports' / 'old.xlsx').write_bytes(b'new')
            target = 'apps.audit.management.commands.copy_media_to_blob.azure_storage'
            with mock.patch(target, return_value=fake):
                dry = StringIO()
                call_command('copy_media_to_blob', '--source', tmp, '--dry-run', stdout=dry)
                self.assertNotIn('pulse/opportunity_attachments/2026/10/deck v2.pdf', store)
                call_command('copy_media_to_blob', '--source', tmp, stdout=StringIO())
        self.assertIn('[upload] pulse/opportunity_attachments/2026/10/deck v2.pdf', dry.getvalue())
        self.assertEqual(store['pulse/opportunity_attachments/2026/10/deck v2.pdf'], (b'%PDF', 'application/pdf'))
        self.assertEqual(store['imports/old.xlsx'], (b'already', 'x'))
