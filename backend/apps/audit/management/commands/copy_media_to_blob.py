import mimetypes
from pathlib import Path

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import ContentSettings
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ._blob import azure_storage


class Command(BaseCommand):
    help = (
        'Upload every file under MEDIA_ROOT (or --source) to the Azure Blob container under the same '
        'relative name, so existing database rows keep working. Existing blobs are never overwritten.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--source', default=str(settings.MEDIA_ROOT), help='Folder to copy (default: MEDIA_ROOT).')
        parser.add_argument('--dry-run', action='store_true', help='List what would be uploaded without uploading.')

    def handle(self, *args, **options):
        storage = azure_storage()
        source = Path(options['source'])
        if not source.is_dir():
            raise CommandError(f'Source folder not found: {source}')
        dry_run = options['dry_run']
        prefix = storage.location.strip('/')

        uploaded = skipped = failed = 0
        files = sorted(path for path in source.rglob('*') if path.is_file())
        self.stdout.write(f'{len(files)} files in {source} -> container {storage.azure_container}')
        for path in files:
            relative = path.relative_to(source).as_posix()
            blob_name = f'{prefix}/{relative}' if prefix else relative
            blob = storage.client.get_blob_client(blob_name)
            if dry_run:
                state = 'exists' if blob.exists() else 'upload'
                self.stdout.write(f'  [{state}] {relative}')
                skipped += state == 'exists'
                uploaded += state == 'upload'
                continue
            content_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
            try:
                with path.open('rb') as handle:
                    blob.upload_blob(
                        handle,
                        overwrite=False,
                        content_settings=ContentSettings(content_type=content_type),
                    )
                uploaded += 1
            except ResourceExistsError:
                skipped += 1
            except Exception as exc:
                failed += 1
                self.stderr.write(f'  failed {relative}: {exc.__class__.__name__}: {exc}')

        verb = 'Would upload' if dry_run else 'Uploaded'
        summary = f'{verb} {uploaded}, already in Blob {skipped}, failed {failed}.'
        self.stdout.write(self.style.SUCCESS(summary) if not failed else self.style.WARNING(summary))
        if failed:
            raise CommandError('Some files failed to upload; rerun to retry (existing blobs are skipped).')
