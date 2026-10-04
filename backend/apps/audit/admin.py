from django.contrib import admin
from .models import AuditLog, ImportLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'user', 'action', 'entity_type', 'entity_id']
    list_filter = ['action', 'entity_type']
    search_fields = ['entity_id', 'user__email']
    readonly_fields = [
        'id', 'user', 'entity_type', 'entity_id',
        'action', 'old_value', 'new_value', 'timestamp'
    ]
    ordering = ['-timestamp']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ImportLog)
class ImportLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'module', 'file_name', 'uploaded_by', 'created_count', 'updated_count', 'error_count']
    list_filter = ['module']
    search_fields = ['file_name', 'uploaded_by__email']
    readonly_fields = [
        'id', 'module', 'file_name', 'byte_size', 'file', 'uploaded_by',
        'created_count', 'updated_count', 'error_count', 'warning_count',
        'errors', 'warnings', 'created_at',
    ]
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False
