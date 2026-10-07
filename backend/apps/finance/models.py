import uuid
from datetime import timedelta

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


class PurchaseOrderStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class InvoiceStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SENT = 'SENT', 'Invoice Sent'
    PARTIAL = 'PARTIAL', 'Partial'
    PAID = 'PAID', 'Paid'
    OVERDUE = 'OVERDUE', 'Overdue'


class PayableStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    PAID = 'PAID', 'Paid'


PAYABLE_TERMS_DAYS = 30


def payable_due_date(invoice_date):
    return invoice_date + timedelta(days=PAYABLE_TERMS_DAYS) if invoice_date else None


class CashflowDirection(models.TextChoices):
    INFLOW = 'INFLOW', 'Inflow'
    OUTFLOW = 'OUTFLOW', 'Outflow'


class CashflowBucket(models.TextChoices):
    REVENUE = 'REVENUE', 'Revenue'
    CAPITAL = 'CAPITAL', 'Capital'
    OPERATING = 'OPERATING', 'Operating'


class CashflowAccount(models.TextChoices):
    CURRENT = 'CURRENT', 'Current / Operational'
    SEED = 'SEED', 'Seed Account'


class CapitalType(models.TextChoices):
    INVESTMENT_RECEIVED = 'INVESTMENT_RECEIVED', 'Investments Received'
    INVESTMENT_MADE = 'INVESTMENT_MADE', 'Investments Made'
    LOAN_PROVIDED = 'LOAN_PROVIDED', 'Loans Provided'
    LOAN_TAKEN = 'LOAN_TAKEN', 'Loans Taken'


class PurchaseOrder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po_number = models.CharField(max_length=80, db_index=True)
    company = models.ForeignKey(
        'business.Company',
        on_delete=models.PROTECT,
        related_name='purchase_orders',
        null=True,
        blank=True,
    )
    customer_name = models.CharField(max_length=255)
    billing_entity = models.CharField(max_length=255, blank=True)
    service_category = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    po_date = models.DateField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    total_value = models.DecimalField(max_digits=15, decimal_places=2)
    monthly_billing = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    billing_cycle = models.CharField(max_length=40, blank=True)
    status = models.CharField(
        max_length=20,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.ACTIVE,
        db_index=True,
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'purchase_orders'
        ordering = ['-po_date', '-created_at']

    def __str__(self):
        return self.po_number


class Invoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=80, db_index=True)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices',
    )
    company = models.ForeignKey(
        'business.Company',
        on_delete=models.PROTECT,
        related_name='invoices',
        null=True,
        blank=True,
    )
    customer_name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    taxable_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tds_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tds_section = models.CharField(max_length=40, blank=True)
    amount_received = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    received_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.SENT,
        db_index=True,
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invoices'
        ordering = ['-invoice_date', '-created_at']

    def __str__(self):
        return self.invoice_number

    def save(self, *args, **kwargs):
        if self.invoice_date and not self.due_date:
            self.due_date = payable_due_date(self.invoice_date)
        super().save(*args, **kwargs)

    @property
    def balance(self):
        return self.amount - self.amount_received


class Payable(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vendor = models.CharField(max_length=255, db_index=True)
    category = models.CharField(max_length=100, blank=True)
    invoice_number = models.CharField(max_length=80, blank=True)
    month_label = models.CharField(max_length=20, blank=True)
    taxable_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tds_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    payable_amount = models.DecimalField(max_digits=15, decimal_places=2)
    invoice_date = models.DateField(null=True, blank=True, db_index=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=PayableStatus.choices,
        default=PayableStatus.PENDING,
        db_index=True,
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payables'
        ordering = ['-invoice_date', '-created_at']

    def __str__(self):
        return f'{self.vendor} {self.invoice_number}'.strip()

    def save(self, *args, **kwargs):
        if self.invoice_date and not self.due_date:
            self.due_date = payable_due_date(self.invoice_date)
        super().save(*args, **kwargs)


class PayableReminderEmailLog(models.Model):
    """Dedup log for automated payable due-date reminder emails."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payable = models.ForeignKey(
        Payable,
        on_delete=models.CASCADE,
        related_name='reminder_email_logs',
    )
    offset_days = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    recipients = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payable_reminder_email_logs'
        ordering = ['-sent_at']
        constraints = [
            models.UniqueConstraint(
                fields=['payable', 'offset_days', 'due_date'],
                name='uniq_payable_reminder_email_log',
            ),
            models.CheckConstraint(
                condition=models.Q(offset_days__in=[1, 3]),
                name='payable_reminder_email_offset_days_valid',
            ),
        ]

    def __str__(self):
        return f'{self.offset_days}d {self.payable_id}'


class InvoiceReminderEmailLog(models.Model):
    """Dedup log for automated receivable due-date reminder emails."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='reminder_email_logs',
    )
    offset_days = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    recipients = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'invoice_reminder_email_logs'
        ordering = ['-sent_at']
        constraints = [
            models.UniqueConstraint(
                fields=['invoice', 'offset_days', 'due_date'],
                name='uniq_invoice_reminder_email_log',
            ),
            models.CheckConstraint(
                condition=models.Q(offset_days__in=[1, 3]),
                name='invoice_reminder_email_offset_days_valid',
            ),
        ]

    def __str__(self):
        return f'{self.offset_days}d {self.invoice_id}'


class CashflowEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.CharField(
        max_length=10,
        choices=CashflowAccount.choices,
        default=CashflowAccount.CURRENT,
        db_index=True,
    )
    entry_date = models.DateField(db_index=True)
    direction = models.CharField(max_length=10, choices=CashflowDirection.choices)
    bucket = models.CharField(
        max_length=20,
        choices=CashflowBucket.choices,
        default=CashflowBucket.OPERATING,
    )
    category = models.CharField(max_length=100)
    sub_category = models.CharField(max_length=100, blank=True)
    entity = models.CharField(max_length=255, blank=True)
    voucher_no = models.CharField(max_length=80, blank=True, db_index=True)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cashflow_entries'
        ordering = ['-entry_date', '-created_at']

    def __str__(self):
        return f'{self.direction} {self.category} {self.amount}'


class CapitalEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    capital_type = models.CharField(max_length=30, choices=CapitalType.choices, db_index=True)
    counterparty = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    entry_date = models.DateField()
    status = models.CharField(max_length=40, default='Active')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'capital_entries'
        ordering = ['-entry_date', '-created_at']

    def __str__(self):
        return f'{self.capital_type} {self.counterparty}'


class MisUpload(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)
    byte_size = models.PositiveIntegerField()
    storage_path = models.CharField(max_length=500)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='mis_uploads',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mis_uploads'
        ordering = ['-created_at']

    def __str__(self):
        return self.file_name


class ComplianceStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    COMPLETED = 'COMPLETED', 'Completed'
    NOT_APPLICABLE = 'NOT_APPLICABLE', 'Not Applicable'


class ComplianceItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=500)
    form_name = models.CharField(max_length=255, blank=True)
    applicable_act = models.CharField(max_length=150, db_index=True)
    period_month = models.DateField(db_index=True, help_text='First day of the compliance month')
    due_date = models.DateField(null=True, blank=True, db_index=True)
    due_date_note = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ComplianceStatus.choices,
        default=ComplianceStatus.PENDING,
        db_index=True,
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_compliance_items',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'compliance_items'
        ordering = ['due_date', 'period_month', 'title']
        indexes = [
            models.Index(fields=['period_month', 'status']),
            models.Index(fields=['due_date', 'status']),
        ]

    def __str__(self):
        return self.title


class FinanceClient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, db_index=True)
    company = models.ForeignKey(
        'business.Company',
        on_delete=models.SET_NULL,
        related_name='finance_clients',
        null=True,
        blank=True,
    )
    service_line = models.CharField(max_length=150, blank=True)
    contact_person = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    mobile = models.CharField(max_length=20, blank=True)
    pan = models.CharField(max_length=10, blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    msme_registered = models.BooleanField(default=False)
    msme_number = models.CharField(max_length=40, blank=True)
    billing_address = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    payment_terms_days = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_clients'
        ordering = ['name']

    def __str__(self):
        return self.name


class FinanceVendor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, db_index=True)
    category = models.CharField(max_length=100, blank=True)
    contact_person = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    mobile = models.CharField(max_length=20, blank=True)
    pan = models.CharField(max_length=10, blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    msme_registered = models.BooleanField(default=False)
    msme_number = models.CharField(max_length=40, blank=True)
    tds_applicable = models.BooleanField(default=False)
    tds_section = models.CharField(max_length=20, blank=True)
    tds_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=40, blank=True)
    ifsc = models.CharField(max_length=11, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_vendors'
        ordering = ['name']

    def __str__(self):
        return self.name
