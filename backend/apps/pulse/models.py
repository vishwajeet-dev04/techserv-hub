import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.pulse.constants import HIGH_VALUE_INR, SALES_STAGES


class OpportunityStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    WON = 'WON', 'Won'
    LOST = 'LOST', 'Lost'


class ReminderType(models.TextChoices):
    FOLLOW_UP = 'FOLLOW_UP', 'Follow Up'
    TASK = 'TASK', 'Task'
    HIGH_VALUE_ALERT = 'HIGH_VALUE_ALERT', 'High Value Alert'
    CLOSE_DATE = 'CLOSE_DATE', 'Close Date'
    STALE_OPPORTUNITY = 'STALE_OPPORTUNITY', 'Stale Opportunity'


class ReminderStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    DONE = 'DONE', 'Done'


class PulseContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, db_index=True)
    company = models.ForeignKey(
        'business.Company',
        on_delete=models.PROTECT,
        related_name='pulse_contacts',
    )
    designation = models.CharField(max_length=150, blank=True)
    department = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True, db_index=True)
    company_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    address_1 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    gst_number = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pulse_contacts'
        ordering = ['name']

    def __str__(self):
        return self.name


class Opportunity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prospect_number = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255, db_index=True)
    company = models.ForeignKey(
        'business.Company',
        on_delete=models.PROTECT,
        related_name='pulse_opportunities',
    )
    contact = models.ForeignKey(
        PulseContact,
        on_delete=models.PROTECT,
        related_name='opportunities',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pulse_opportunities',
    )
    owner_name = models.CharField(max_length=255, blank=True)
    lead_source = models.CharField(max_length=150, blank=True)
    service_pillar = models.CharField(max_length=100, blank=True, db_index=True)
    sub_category = models.CharField(max_length=150, blank=True)
    delivery_partner = models.CharField(max_length=150, blank=True)
    stage = models.CharField(
        max_length=40,
        default=SALES_STAGES[0],
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=OpportunityStatus.choices,
        default=OpportunityStatus.OPEN,
        db_index=True,
    )
    expected_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    negotiated_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default='INR')
    department = models.CharField(max_length=150, blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    expected_close_date = models.DateField(null=True, blank=True)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pulse_opportunities'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.prospect_number} {self.name}'

    @property
    def display_amount(self) -> Decimal:
        if self.negotiated_amount:
            return self.negotiated_amount
        return self.expected_amount or Decimal('0')

    @property
    def is_high_value(self) -> bool:
        return self.display_amount >= HIGH_VALUE_INR


class OpportunityActivityAction(models.TextChoices):
    STAGE_CHANGE = 'STAGE_CHANGE', 'Stage Change'
    FOLLOW_UP_CHANGE = 'FOLLOW_UP_CHANGE', 'Follow-up Change'
    DOCUMENT_UPDATE = 'DOCUMENT_UPDATE', 'Documents Updated'
    NOTE = 'NOTE', 'Note'
    FIELD_UPDATE = 'FIELD_UPDATE', 'Field Update'


class OpportunityActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name='activities',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pulse_opportunity_activities',
    )
    action = models.CharField(max_length=20, choices=OpportunityActivityAction.choices)
    from_stage = models.CharField(max_length=40, blank=True)
    to_stage = models.CharField(max_length=40, blank=True)
    note = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pulse_opportunity_activities'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} {self.opportunity_id}'


class OpportunityActivityAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey(
        OpportunityActivity,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file = models.FileField(upload_to='pulse/opportunity_attachments/%Y/%m/')
    file_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True)
    byte_size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pulse_activity_attachments',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pulse_opportunity_activity_attachments'
        ordering = ['created_at']

    def __str__(self):
        return self.file_name


class Reminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    reminder_type = models.CharField(
        max_length=30,
        choices=ReminderType.choices,
        default=ReminderType.TASK,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=ReminderStatus.choices,
        default=ReminderStatus.PENDING,
        db_index=True,
    )
    due_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reminders',
    )
    contact = models.ForeignKey(
        PulseContact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reminders',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pulse_reminders'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class OpportunityReminderEmailKind(models.TextChoices):
    FOLLOW_UP = 'FOLLOW_UP', 'Follow Up'
    CLOSE = 'CLOSE', 'Close Date'


class OpportunityReminderEmailLog(models.Model):
    """Dedup log for automated follow-up / close-date reminder emails."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name='reminder_email_logs',
    )
    reminder_kind = models.CharField(
        max_length=20,
        choices=OpportunityReminderEmailKind.choices,
        db_index=True,
    )
    offset_days = models.PositiveSmallIntegerField()
    target_date = models.DateField()
    recipient_email = models.EmailField()
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pulse_opportunity_reminder_email_logs'
        ordering = ['-sent_at']
        constraints = [
            models.UniqueConstraint(
                fields=['opportunity', 'reminder_kind', 'offset_days', 'target_date'],
                name='uniq_opp_reminder_email_log',
            ),
            models.CheckConstraint(
                condition=models.Q(offset_days__in=[1, 3]),
                name='opp_reminder_email_offset_days_valid',
            ),
        ]

    def __str__(self):
        return f'{self.reminder_kind} {self.offset_days}d {self.opportunity_id}'
