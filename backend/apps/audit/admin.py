from django.contrib import admin
from .models import AuditLog


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