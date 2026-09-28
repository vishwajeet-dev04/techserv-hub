from django.contrib import admin
from .models import (
    CapitalEntry,
    CashflowEntry,
    ComplianceItem,
    FinancialDocument,
    FinancialMetric,
    FinancialPeriod,
    Invoice,
    MisUpload,
    Payable,
    PurchaseOrder,
)


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


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ['po_number', 'customer_name', 'total_value', 'status', 'po_date']
    list_filter = ['status']
    search_fields = ['po_number', 'customer_name']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'customer_name', 'amount', 'status', 'due_date']
    list_filter = ['status']
    search_fields = ['invoice_number', 'customer_name']


@admin.register(Payable)
class PayableAdmin(admin.ModelAdmin):
    list_display = ['vendor', 'invoice_number', 'payable_amount', 'tds_amount', 'status', 'due_date']
    list_filter = ['status']
    search_fields = ['vendor', 'invoice_number']


@admin.register(CashflowEntry)
class CashflowEntryAdmin(admin.ModelAdmin):
    list_display = ['entry_date', 'direction', 'category', 'entity', 'amount']
    list_filter = ['direction', 'bucket']


@admin.register(CapitalEntry)
class CapitalEntryAdmin(admin.ModelAdmin):
    list_display = ['capital_type', 'counterparty', 'amount', 'entry_date', 'status']
    list_filter = ['capital_type']


@admin.register(MisUpload)
class MisUploadAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'byte_size', 'uploaded_by', 'created_at']
    search_fields = ['file_name']
    readonly_fields = ['storage_path']
    raw_id_fields = ['uploaded_by']


@admin.register(ComplianceItem)
class ComplianceItemAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'form_name', 'applicable_act', 'period_month',
        'due_date', 'status', 'created_at',
    ]
    list_filter = ['status', 'applicable_act', 'period_month']
    search_fields = ['title', 'form_name', 'applicable_act', 'due_date_note']
    ordering = ['due_date', 'period_month']
    raw_id_fields = ['created_by']
