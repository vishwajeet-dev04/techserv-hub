import logging
from decimal import Decimal
from django.db.models import Q, Sum, Count
from django.utils import timezone

from apps.deals.models import Deal, DealActivity, DealStage

logger = logging.getLogger(__name__)


def get_deal_list(
    search: str = None,
    stage: str = None,
    owner_id=None,
    company_id=None,
):
    qs = Deal.objects.select_related('company', 'owner')

    if search:
        qs = qs.filter(
            Q(name__icontains=search) |
            Q(company__name__icontains=search)
        )

    if stage:
        qs = qs.filter(stage=stage)

    if owner_id:
        qs = qs.filter(owner_id=owner_id)

    if company_id:
        qs = qs.filter(company_id=company_id)

    return qs.order_by('-created_at')


def get_deal(deal_id) -> Deal:
    return (
        Deal.objects
        .select_related('company', 'owner')
        .prefetch_related('activities__created_by')
        .get(pk=deal_id)
    )


def get_deal_activities(deal_id):
    return (
        DealActivity.objects
        .filter(deal_id=deal_id)
        .select_related('created_by')
        .order_by('-activity_date', '-created_at')
    )


def get_pipeline_summary() -> dict:
    active_deals = Deal.objects.exclude(stage__in=[DealStage.WON, DealStage.LOST])

    total_pipeline = active_deals.aggregate(
        total=Sum('value')
    )['total'] or Decimal('0')

    weighted_pipeline = sum(
        deal.weighted_value for deal in active_deals.only('value', 'probability')
    )

    by_stage = active_deals.values('stage').annotate(
        count=Count('id'),
        total_value=Sum('value')
    ).order_by('stage')

    today = timezone.now().date()
    thirty_days = today + timezone.timedelta(days=30)
    closing_soon = active_deals.filter(
        expected_close_date__gte=today,
        expected_close_date__lte=thirty_days
    ).count()

    now = timezone.now()
    won_this_month = Deal.objects.filter(
        stage=DealStage.WON,
        updated_at__year=now.year,
        updated_at__month=now.month
    ).aggregate(count=Count('id'), total=Sum('value'))

    return {
        'total_pipeline': float(total_pipeline),
        'weighted_pipeline': float(weighted_pipeline),
        'active_deals_count': active_deals.count(),
        'closing_soon_count': closing_soon,
        'won_this_month_count': won_this_month['count'] or 0,
        'won_this_month_value': float(won_this_month['total'] or 0),
        'by_stage': list(by_stage),
    }


def set_default_probability(stage: str) -> int:
    defaults = {
        DealStage.LEAD: 10,
        DealStage.QUALIFIED: 25,
        DealStage.REQUIREMENT: 40,
        DealStage.PROPOSAL: 60,
        DealStage.NEGOTIATION: 80,
        DealStage.WON: 100,
        DealStage.LOST: 0,
    }
    return defaults.get(stage, 0)