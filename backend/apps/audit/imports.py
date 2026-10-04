import logging

from django.core.files.base import ContentFile

from .models import ImportLog

logger = logging.getLogger(__name__)

MAX_STORED_ISSUES = 500


def record_import(request, module: str, content: bytes, result: dict) -> ImportLog | None:
    """Store who imported which file, when, and the outcome. Never breaks the import itself."""
    upload = request.FILES.get('file')
    file_name = (getattr(upload, 'name', '') or 'upload.xlsx')[:255]
    errors = list(result.get('errors') or [])
    warnings = list(result.get('warnings') or [])
    try:
        log = ImportLog(
            module=module,
            file_name=file_name,
            byte_size=len(content),
            uploaded_by=request.user if request.user.is_authenticated else None,
            created_count=result.get('created') or 0,
            updated_count=result.get('updated') or 0,
            error_count=len(errors),
            warning_count=len(warnings),
            errors=errors[:MAX_STORED_ISSUES],
            warnings=warnings[:MAX_STORED_ISSUES],
        )
        log.file.save(file_name, ContentFile(content), save=False)
        log.save()
    except Exception:
        logger.exception('Could not record %s import of %s', module, file_name)
        return None
    result['import_log_id'] = str(log.id)
    return log
