import uuid
from django.db import models
from django.conf import settings


class PeriodType(models.TextChoices):
    MONTHLY = 'MONTHLY', 'Monthly'
    QUARTERLY = 'QUARTERLY', 'Quarterly'
    ANNUAL = 'ANNUAL', 'Annual'


class DocumentType(models.TextChoices):
    PROFIT_LOSS = 'PROFIT_LOSS', 'Profit & Loss'
    BALANCE_SHEET = 'BALANCE_SHEET', 'Balance Sheet'
    CASH_FLOW = 'CASH_FLOW', 'Cash Flow Statement'
    BANK_STATEMENT = 'BANK_STATEMENT', 'Bank Statement'
    MANAGEMENT_REPORT = 'MANAGEMENT_REPORT', 'Management Report'
    OTHER = 'OTHER', 'Other'


class ExtractionStatus(models.TextChoices):
    UPLOADED = 'UPLOADED', 'Uploaded'
    PROCESSING = 'PROCESSING', 'Processing'
    EXTRACTED = 'EXTRACTED', 'Extracted'
    FAILED = 'FAILED', 'Failed'


class ValidationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    VALID = 'VALID', 'Valid'
    REQUIRES_REVIEW = 'REQUIRES_REVIEW', 'Requires Review'
    REJECTED = 'REJECTED', 'Rejected'


METRIC_CODES = [
    'revenue',
    'expenses',
    'gross_profit',
    'operating_profit',
    'net_profit',
    'cash',
    'receivables',
    'payables',
    'assets',
    'liabilities',
    'equity',
    'cost_of_goods_sold',
    'operating_expenses',
    'tax',
]


class FinancialPeriod(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period_type = models.CharField(max_length=20, choices=PeriodType.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    label = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'financial_periods'
        ordering = ['-start_date']

    def __str__(self):
        return self.label


class FinancialDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)
    storage_path = models.CharField(max_length=500)
    document_type = models.CharField(
        max_length=30,
        choices=DocumentType.choices
    )
    financial_period = models.ForeignKey(
        FinancialPeriod,
        on_delete=models.PROTECT,
        related_name='documents',
        null=True,
        blank=True
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents'
    )
    extraction_status = models.CharField(
        max_length=20,
        choices=ExtractionStatus.choices,
        default=ExtractionStatus.UPLOADED,
        db_index=True
    )
    validation_status = models.CharField(
        max_length=20,
        choices=ValidationStatus.choices,
        default=ValidationStatus.PENDING,
        db_index=True
    )
    extraction_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'financial_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.file_name} ({self.document_type})'


class FinancialMetric(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    financial_period = models.ForeignKey(
        FinancialPeriod,
        on_delete=models.PROTECT,
        related_name='metrics',
        db_index=True
    )
    metric_code = models.CharField(max_length=50, db_index=True)
    value = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    source_document = models.ForeignKey(
        FinancialDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='extracted_metrics'
    )
    source_reference = models.CharField(max_length=255, blank=True)
    confidence = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        null=True,
        blank=True
    )
    is_manual = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_metrics'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'financial_metrics'
        ordering = ['-financial_period__start_date', 'metric_code']
        unique_together = [['financial_period', 'metric_code', 'source_document']]

    def __str__(self):
        return f'{self.metric_code}: {self.value} ({self.financial_period.label})'