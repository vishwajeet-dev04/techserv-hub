from django.core.files.storage import storages
from django.core.management.base import CommandError


def azure_storage():
    """Return the configured AzureStorage, or fail with a hint when Blob is not enabled."""
    from storages.backends.azure_storage import AzureStorage

    storage = storages['default']
    if not isinstance(storage, AzureStorage):
        raise CommandError(
            'Azure Blob is not enabled: set AZURE_CONTAINER plus AZURE_ACCOUNT_NAME/AZURE_ACCOUNT_KEY '
            '(or AZURE_CONNECTION_STRING) in .env, then restart.'
        )
    return storage
