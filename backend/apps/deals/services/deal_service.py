import logging
from decimal import Decimal
from datetime import timedelta
from django.db.models import Q
from django.utils import timezone

from apps.deals.models import Deal, DealActivity, DealStage

logger = logging.getLogger(__name__)


STAGE_ORDER = [
    DealStage.LEAD,
    DealStage.QUALIFIED,
    DealStage.REQUIREMENT,
    DealStage.PROPOSAL,
    DealStage.NEGOTIATION,
    DealStage.WON,
    DealStage.LOST,
]


def get_deal_list(
    search: str = None,
    stage: str = None,
    owner_id=None,
    company_id=None,
    service_pillar: str = None,
    source: str = None,
):
    qs = Deal.objects.select_related('company', 'owner')

    if search:
        qs = qs.filter(
            Q(name__icontains=search) |
            Q(company__name__icontains=search) |
            Q(service_pillar__icontains=search) |
            Q(sub_category__icontains=search)
        )

    if stage:
        qs = qs.filter(stage=stage)

    if owner_id:
        qs = qs.filter(owner_id=owner_id)

    if company_id:
        qs = qs.filter(company_id=company_id)

    if service_pillar:
        qs = qs.filter(service_pillar__iexact=service_pillar)

    if source:
        qs = qs.filter(source__iexact=source)

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


def _empty_stage_row(stage: str) -> dict:
    return {
        'stage': stage,
        'count': 0,
        'total_value': 0.0,
        'weighted_value': 0.0,
    }


def get_pipeline_summary() -> dict:
    all_deals = list(Deal.objects.select_related('company', 'owner'))
    active_deals = [deal for deal in all_deals if deal.is_active]
    won_deals = [deal for deal in all_deals if deal.stage == DealStage.WON]
    lost_deals = [deal for deal in all_deals if deal.stage == DealStage.LOST]

    total_pipeline = sum((deal.value for deal in active_deals), Decimal('0'))
    weighted_pipeline = sum((deal.weighted_value for deal in active_deals), Decimal('0'))

    by_stage_map = {stage: _empty_stage_row(stage) for stage in STAGE_ORDER}
    funnel_map = {stage: _empty_stage_row(stage) for stage in STAGE_ORDER}
    by_pillar: dict[str, dict] = {}
    by_owner: dict[str, dict] = {}
    by_source: dict[str, dict] = {}

    def _bump(bucket: dict, key: str, label: str, deal: Deal):
        row = bucket.setdefault(
            key,
            {
                'name': label,
                'count': 0,
                'total_value': 0.0,
                'weighted_value': 0.0,
                'won_count': 0,
                'lost_count': 0,
                'active_count': 0,
            },
        )
        row['count'] += 1
        row['total_value'] += float(deal.value)
        row['weighted_value'] += float(deal.weighted_value)
        if deal.stage == DealStage.WON:
            row['won_count'] += 1
        elif deal.stage == DealStage.LOST:
            row['lost_count'] += 1
        else:
            row['active_count'] += 1

    for deal in all_deals:
        funnel_row = funnel_map.setdefault(deal.stage, _empty_stage_row(deal.stage))
        funnel_row['count'] += 1
        funnel_row['total_value'] += float(deal.value)
        funnel_row['weighted_value'] += float(deal.weighted_value)

        if deal.is_active:
            stage_row = by_stage_map.setdefault(deal.stage, _empty_stage_row(deal.stage))
            stage_row['count'] += 1
            stage_row['total_value'] += float(deal.value)
            stage_row['weighted_value'] += float(deal.weighted_value)

        pillar_label = deal.service_pillar.strip() if deal.service_pillar else 'Uncategorised'
        _bump(by_pillar, pillar_label.lower(), pillar_label, deal)

        owner_key = str(deal.owner_id) if deal.owner_id else 'unassigned'
        owner_label = deal.owner.name if deal.owner else 'Unassigned'
        _bump(by_owner, owner_key, owner_label, deal)

        source_label = deal.source.strip() if deal.source else 'Unspecified'
        _bump(by_source, source_label.lower(), source_label, deal)

    today = timezone.now().date()
    thirty_days = today + timedelta(days=30)
    closing_soon = sum(
        1
        for deal in active_deals
        if deal.expected_close_date and today <= deal.expected_close_date <= thirty_days
    )

    now = timezone.now()
    won_this_month = [
        deal for deal in won_deals
        if deal.updated_at.year == now.year and deal.updated_at.month == now.month
    ]
    closed_count = len(won_deals) + len(lost_deals)
    win_rate = round(len(won_deals) / closed_count * 100, 1) if closed_count else 0.0

    return {
        'total_pipeline': float(total_pipeline),
        'weighted_pipeline': float(weighted_pipeline),
        'active_deals_count': len(active_deals),
        'closing_soon_count': closing_soon,
        'won_this_month_count': len(won_this_month),
        'won_this_month_value': float(sum((deal.value for deal in won_this_month), Decimal('0'))),
        'won_count': len(won_deals),
        'won_value': float(sum((deal.value for deal in won_deals), Decimal('0'))),
        'lost_count': len(lost_deals),
        'lost_value': float(sum((deal.value for deal in lost_deals), Decimal('0'))),
        'win_rate': win_rate,
        'by_stage': [row for row in by_stage_map.values() if row['count'] > 0],
        'funnel': list(funnel_map.values()),
        'by_pillar': sorted(by_pillar.values(), key=lambda row: row['total_value'], reverse=True),
        'by_owner': sorted(by_owner.values(), key=lambda row: row['weighted_value'], reverse=True),
        'by_source': sorted(by_source.values(), key=lambda row: row['total_value'], reverse=True),
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


def get_active_deals():
    return Deal.objects.exclude(stage__in=[DealStage.WON, DealStage.LOST]).select_related('company')


def count_overdue_deals() -> int:
    today = timezone.now().date()
    return get_active_deals().filter(expected_close_date__lt=today).count()


def count_deals_closing_within(days: int = 7) -> int:
    today = timezone.now().date()
    return get_active_deals().filter(
        expected_close_date__gte=today,
        expected_close_date__lte=today + timedelta(days=days),
    ).count()