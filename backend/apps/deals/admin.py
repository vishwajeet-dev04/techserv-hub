from django.contrib import admin
from .models import Deal, DealActivity


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