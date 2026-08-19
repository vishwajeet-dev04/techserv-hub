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