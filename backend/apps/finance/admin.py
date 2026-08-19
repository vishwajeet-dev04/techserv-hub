from django.contrib import admin
from .models import FinancialPeriod, FinancialDocument, FinancialMetric


@admin.register(FinancialPeriod)
class FinancialPeriodAdmin(admin.ModelAdmin):
    list_display = ['label', 'period_type', 'start_date', 'end_date']
    list_filter = ['period_type']
    search_fields = ['label']
    ordering = ['-start_date']


@admin.register(FinancialDocument)
class FinancialDocumentAdmin(admin.ModelAdmin):
    list_display = [
        'file_name', 'document_type', 'financial_period',
        'extraction_status', 'validation_status', 'uploaded_by', 'created_at'
    ]
    list_filter = ['document_type', 'extraction_status', 'validation_status']
    search_fields = ['file_name']
    ordering = ['-created_at']
    readonly_fields = ['storage_path', 'extraction_error']
    raw_id_fields = ['uploaded_by', 'financial_period']


@admin.register(FinancialMetric)
class FinancialMetricAdmin(admin.ModelAdmin):
    list_display = [
        'metric_code', 'value', 'currency',
        'financial_period', 'is_manual', 'confidence', 'created_at'
    ]
    list_filter = ['metric_code', 'currency', 'is_manual']
    search_fields = ['metric_code', 'financial_period__label']
    ordering = ['-financial_period__start_date', 'metric_code']
    raw_id_fields = ['financial_period', 'source_document', 'created_by']