from django.contrib import admin
from .models import Deal, DealActivity, PoDocumentIssue


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'stage', 'value', 'currency', 'probability', 'expected_close_date', 'owner']
    list_filter = ['stage', 'currency']
    search_fields = ['name', 'company__name']
    ordering = ['-created_at']
    raw_id_fields = ['company', 'owner']


@admin.register(DealActivity)
class DealActivityAdmin(admin.ModelAdmin):
    list_display = ['subject', 'deal', 'type', 'activity_date', 'created_by']
    list_filter = ['type']
    search_fields = ['subject', 'deal__name']
    ordering = ['-activity_date']
    raw_id_fields = ['deal', 'created_by']


@admin.register(PoDocumentIssue)
class PoDocumentIssueAdmin(admin.ModelAdmin):
    list_display = ['opportunity', 'status', 'raised_by', 'created_at', 'email_sent_at', 'resolved_at']
    list_filter = ['status']
    search_fields = ['opportunity__prospect_number', 'opportunity__name', 'note']
    ordering = ['-created_at']
    raw_id_fields = ['opportunity', 'raised_by', 'resolved_by', 'resolution_activity']
    filter_horizontal = ['attachments']