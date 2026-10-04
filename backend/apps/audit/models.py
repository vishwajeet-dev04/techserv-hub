import uuid
from django.db import models
from django.conf import settings


class AuditAction(models.TextChoices):
    CREATE = 'CREATE', 'Create'
    UPDATE = 'UPDATE', 'Update'
    DELETE = 'DELETE', 'Delete'
    LOGIN = 'LOGIN', 'Login'
    LOGOUT = 'LOGOUT', 'Logout'
    UPLOAD = 'UPLOAD', 'Upload'
    APPROVE = 'APPROVE', 'Approve'


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    entity_type = models.CharField(max_length=50, db_index=True)
    entity_id = models.CharField(max_length=50, db_index=True)
    action = models.CharField(max_length=20, choices=AuditAction.choices)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.action} {self.entity_type} {self.entity_id} by {self.user}'


class ImportModule(models.TextChoices):
    PULSE_CONTACTS = 'PULSE_CONTACTS', 'Pulse contacts'
    PULSE_OPPORTUNITIES = 'PULSE_OPPORTUNITIES', 'Pulse opportunities'
    PO_WORKFLOW = 'PO_WORKFLOW', 'PO workflow'
    MASTER_CLIENTS = 'MASTER_CLIENTS', 'Master data: clients'
    MASTER_VENDORS = 'MASTER_VENDORS', 'Master data: vendors'


def import_upload_path(instance, filename):
    return f'imports/{uuid.uuid4().hex}.xlsx'


class ImportLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.CharField(max_length=32, choices=ImportModule.choices, db_index=True)
    file_name = models.CharField(max_length=255)
    byte_size = models.PositiveIntegerField(default=0)
    file = models.FileField(upload_to=import_upload_path, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='import_logs',
    )
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    warning_count = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'import_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_module_display()} import of {self.file_name}'