import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


class DealStage(models.TextChoices):
    LEAD = 'LEAD', 'Lead'
    QUALIFIED = 'QUALIFIED', 'Qualified'
    REQUIREMENT = 'REQUIREMENT', 'Requirement'
    PROPOSAL = 'PROPOSAL', 'Proposal'
    NEGOTIATION = 'NEGOTIATION', 'Negotiation'
    WON = 'WON', 'Won'
    LOST = 'LOST', 'Lost'


class DealActivityType(models.TextChoices):
    NOTE = 'NOTE', 'Note'
    CALL = 'CALL', 'Call'
    MEETING = 'MEETING', 'Meeting'
    EMAIL = 'EMAIL', 'Email'
    PROPOSAL = 'PROPOSAL', 'Proposal'
    FOLLOW_UP = 'FOLLOW_UP', 'Follow Up'


class Deal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        'business.Company',
        on_delete=models.PROTECT,
        related_name='deals'
    )
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    currency = models.CharField(max_length=3, default='INR')
    stage = models.CharField(
        max_length=20,
        choices=DealStage.choices,
        default=DealStage.LEAD,
        db_index=True
    )
    probability = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    expected_close_date = models.DateField(null=True, blank=True, db_index=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_deals',
        db_index=True
    )
    source = models.CharField(max_length=100, blank=True)
    service_pillar = models.CharField(max_length=100, blank=True, db_index=True)
    sub_category = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deals'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.company.name})'

    @property
    def weighted_value(self):
        return self.value * Decimal(self.probability) / Decimal(100)

    @property
    def is_active(self):
        return self.stage not in [DealStage.WON, DealStage.LOST]


class DealActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal = models.ForeignKey(
        Deal,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    type = models.CharField(max_length=20, choices=DealActivityType.choices)
    subject = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    activity_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='deal_activities'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'deal_activities'
        ordering = ['-activity_date', '-created_at']

    def __str__(self):
        return f'{self.type}: {self.subject}'


class PoWorkflow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        'business.Company',
        on_delete=models.PROTECT,
        related_name='po_workflows',
    )
    customer_name = models.CharField(max_length=255, db_index=True)
    billing_entity = models.CharField(max_length=120)
    service_pillar = models.CharField(max_length=120)
    po_number = models.CharField(max_length=80, db_index=True)
    po_date = models.DateField(null=True, blank=True)
    agreement = models.CharField(max_length=40)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    expiry = models.DateField(null=True, blank=True)
    total_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    value_per_invoice = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    billing_cycle = models.CharField(max_length=80)
    milestone_details = models.CharField(max_length=255, blank=True)
    billing_due = models.CharField(max_length=120)
    finance_approved_at = models.DateTimeField(null=True, blank=True)
    finance_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_po_workflows',
    )
    finance_purchase_order = models.ForeignKey(
        'finance.PurchaseOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_po_workflows',
    )
    opportunity = models.ForeignKey(
        'pulse.Opportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_workflows',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'po_workflows'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.po_number} ({self.customer_name})'

    @property
    def finance_approved(self) -> bool:
        return self.finance_approved_at is not None


class PoDocumentIssueStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    RESOLVED = 'RESOLVED', 'Resolved'


class PoDocumentIssue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    opportunity = models.ForeignKey(
        'pulse.Opportunity',
        on_delete=models.CASCADE,
        related_name='po_document_issues',
    )
    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='raised_po_document_issues',
    )
    reasons = models.JSONField(default=list)
    attachments = models.ManyToManyField(
        'pulse.OpportunityActivityAttachment',
        blank=True,
        related_name='po_document_issues',
    )
    note = models.TextField(blank=True)
    status = models.CharField(
        max_length=10,
        choices=PoDocumentIssueStatus.choices,
        default=PoDocumentIssueStatus.OPEN,
        db_index=True,
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_po_document_issues',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True)
    resolution_activity = models.ForeignKey(
        'pulse.OpportunityActivity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_po_document_issues',
    )
    email_sent_at = models.DateTimeField(null=True, blank=True)
    resolved_email_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'po_document_issues'
        ordering = ['-created_at']

    def __str__(self):
        return f'PO issue {self.opportunity_id} ({self.status})'
