import uuid
from urllib.request import urlopen

from azure.core.exceptions import ResourceExistsError
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from ._blob import azure_storage


class Command(BaseCommand):
    help = 'Create the private Azure Blob container from AZURE_CONTAINER (if missing) and check read/write/signed URLs.'

    def handle(self, *args, **options):
        storage = azure_storage()
        self.stdout.write(f'Account: {storage.account_name}  Container: {storage.azure_container}')

        try:
            storage.client.create_container()
            self.stdout.write(self.style.SUCCESS('Created private container.'))
        except ResourceExistsError:
            self.stdout.write('Container already exists.')
        except Exception as exc:
            raise CommandError(f'Could not create or reach the container: {exc.__class__.__name__}: {exc}') from exc

        properties = storage.client.get_container_properties()
        if properties.public_access:
            self.stdout.write(self.style.WARNING(
                f'Container public access is "{properties.public_access}". Set it to Private in the Azure portal.'
            ))

        payload = f'blob_setup {uuid.uuid4()}'.encode()
        name = storage.save(f'healthchecks/{uuid.uuid4().hex}.txt', ContentFile(payload))
        try:
            with storage.open(name, 'rb') as handle:
                if handle.read() != payload:
                    raise CommandError('Read-back mismatch.')
            with urlopen(storage.url(name), timeout=20) as response:
                if response.read() != payload:
                    raise CommandError('Signed URL returned different content.')
        finally:
            storage.delete(name)
        self.stdout.write(self.style.SUCCESS('Write, read, signed URL and delete all work.'))
