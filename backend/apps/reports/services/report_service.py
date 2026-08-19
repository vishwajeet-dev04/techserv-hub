import logging
from collections import defaultdict
from datetime import datetime

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.business.services.company_service import get_company_list, get_company_stats
from apps.deals.models import DealStage
from apps.deals.services.deal_service import get_active_deals, get_pipeline_summary
from apps.finance.models import METRIC_CODES, FinancialPeriod
from apps.finance.services.kpi_service import (
    get_financial_dashboard_summary,
    get_period_metrics,
    get_revenue_trend,
)

logger = logging.getLogger(__name__)

EMPTY_FINANCIAL = {
    'revenue': 0.0,
    'expenses': 0.0,
    'gross_profit': 0.0,
    'operating_profit': 0.0,
    'net_profit': 0.0,
    'cash': 0.0,
    'receivables': 0.0,
    'payables': 0.0,
    'assets': 0.0,
    'liabilities': 0.0,
    'equity': 0.0,
    'profit_margin': None,
}


def resolve_period(period_id) -> FinancialPeriod | None:
    if not period_id:
        return FinancialPeriod.objects.order_by('-start_date').first()
    try:
        return FinancialPeriod.objects.get(pk=period_id)
    except (FinancialPeriod.DoesNotExist, ValidationError, ValueError) as exc:
        raise FinancialPeriod.DoesNotExist from exc


def format_inr_compact(amount) -> str:
    value = float(amount or 0)
    sign = '-' if value < 0 else ''
    number = abs(value)
    if number >= 10_000_000:
        compact = number / 10_000_000
        return f'{sign}₹{_trim_compact(compact)}Cr'
    if number >= 100_000:
        compact = number / 100_000
        return f'{sign}₹{_trim_compact(compact)}L'
    return f'{sign}₹{number:,.0f}'


def _trim_compact(compact: float) -> str:
    if compact >= 10:
        return f'{compact:.0f}'
    text = f'{compact:.1f}'
    return text.rstrip('0').rstrip('.')


def _format_margin(value) -> str:
    if value is None:
        return 'n/a'
    rounded = round(float(value))
    if abs(float(value) - rounded) < 0.05:
        return f'{rounded}%'
    return f'{float(value):.1f}%'


def _ratio(numerator, denominator) -> float | None:
    denom = float(denominator or 0)
    if denom == 0:
        return None
    return round(float(numerator or 0) / denom, 4)


def _financial_for_period(period: FinancialPeriod | None) -> dict:
    if not period:
        return dict(EMPTY_FINANCIAL)
    return get_financial_dashboard_summary(period.id)


def _build_highlights(period: FinancialPeriod | None, financial: dict, pipeline: dict) -> list[str]:
    period_label = period.label if period else None
    revenue_text = format_inr_compact(financial.get('revenue'))
    if period_label:
        revenue_highlight = f'Revenue: {revenue_text} for {period_label}'
    else:
        revenue_highlight = f'Revenue: {revenue_text}'
    return [
        revenue_highlight,
        f'Net Profit Margin: {_format_margin(financial.get("profit_margin"))}',
        f'Active Deals: {pipeline.get("active_deals_count", 0)}',
        f'Pipeline Value: {format_inr_compact(pipeline.get("total_pipeline"))}',
    ]


def _serialize_deal(deal) -> dict:
    return {
        'id': str(deal.id),
        'company': str(deal.company_id),
        'company_name': deal.company.name,
        'name': deal.name,
        'description': deal.description,
        'value': float(deal.value),
        'currency': deal.currency,
        'stage': deal.stage,
        'probability': deal.probability,
        'weighted_value': float(deal.weighted_value),
        'expected_close_date': (
            deal.expected_close_date.isoformat() if deal.expected_close_date else None
        ),
        'owner': str(deal.owner_id) if deal.owner_id else None,
        'owner_name': deal.owner.name if deal.owner else None,
        'source': deal.source,
        'notes': deal.notes,
        'created_at': deal.created_at.isoformat(),
        'updated_at': deal.updated_at.isoformat(),
    }


def _generated_at() -> str:
    now: datetime = timezone.now()
    return now.isoformat()


def _available_periods() -> list[dict]:
    return [
        {'id': str(period.id), 'label': period.label}
        for period in FinancialPeriod.objects.order_by('-start_date')
    ]


def build_monthly_summary(period_id=None) -> dict:
    period = resolve_period(period_id)
    financial = _financial_for_period(period)
    pipeline = get_pipeline_summary()
    return {
        'report_type': 'monthly_summary',
        'period': period.label if period else None,
        'generated_at': _generated_at(),
        'financial': financial,
        'pipeline': pipeline,
        'business': get_company_stats(),
        'revenue_trend': get_revenue_trend(limit=6),
        'highlights': _build_highlights(period, financial, pipeline),
        'available_periods': _available_periods(),
    }


def build_sales_pipeline_report() -> dict:
    summary = get_pipeline_summary()
    deals = list(get_active_deals().select_related('owner', 'company'))
    deals_data = [_serialize_deal(deal) for deal in deals]

    by_owner: dict[str, dict] = {}
    by_company: dict[str, dict] = {}
    weighted_by_stage: dict[str, float] = defaultdict(float)

    for deal in deals:
        owner_key = str(deal.owner_id) if deal.owner_id else 'unassigned'
        owner = by_owner.setdefault(
            owner_key,
            {
                'owner_name': deal.owner.name if deal.owner else 'Unassigned',
                'deal_count': 0,
                'total_value': 0.0,
                'weighted_value': 0.0,
            },
        )
        owner['deal_count'] += 1
        owner['total_value'] += float(deal.value)
        owner['weighted_value'] += float(deal.weighted_value)

        company_key = str(deal.company_id)
        company = by_company.setdefault(
            company_key,
            {
                'company_name': deal.company.name,
                'deal_count': 0,
                'total_value': 0.0,
            },
        )
        company['deal_count'] += 1
        company['total_value'] += float(deal.value)
        weighted_by_stage[deal.stage] += float(deal.weighted_value)

    by_stage = []
    for row in summary.get('by_stage', []):
        item = dict(row)
        item['total_value'] = float(item.get('total_value') or 0)
        item['weighted_value'] = round(weighted_by_stage.get(item['stage'], 0.0), 2)
        by_stage.append(item)

    return {
        'report_type': 'sales_pipeline',
        'generated_at': _generated_at(),
        'summary': summary,
        'deals': deals_data,
        'by_owner': sorted(by_owner.values(), key=lambda row: row['total_value'], reverse=True),
        'by_stage': by_stage,
        'by_company': sorted(by_company.values(), key=lambda row: row['total_value'], reverse=True),
    }


def build_financial_summary(period_id=None) -> dict:
    period = resolve_period(period_id)
    metrics = _financial_for_period(period)
    if period:
        raw = get_period_metrics(period.id)
        for code in METRIC_CODES:
            if code not in metrics:
                entry = raw.get(code)
                metrics[code] = float(entry['value']) if entry else 0.0

    period_count = FinancialPeriod.objects.count()
    all_periods = get_revenue_trend(limit=period_count) if period_count else []

    return {
        'report_type': 'financial_summary',
        'period': period.label if period else None,
        'generated_at': _generated_at(),
        'metrics': metrics,
        'all_periods': all_periods,
        'available_periods': _available_periods(),
        'ratios': {
            'profit_margin': metrics.get('profit_margin'),
            'receivables_to_revenue': _ratio(metrics.get('receivables'), metrics.get('revenue')),
            'debt_to_equity': _ratio(metrics.get('liabilities'), metrics.get('equity')),
        },
    }


def build_customer_revenue_report() -> dict:
    companies = []
    for company in get_company_list().prefetch_related('deals'):
        deal_count = 0
        total_deal_value = 0.0
        won_deal_value = 0.0
        active_deal_value = 0.0
        for deal in company.deals.all():
            amount = float(deal.value)
            deal_count += 1
            total_deal_value += amount
            if deal.stage == DealStage.WON:
                won_deal_value += amount
            elif deal.stage != DealStage.LOST:
                active_deal_value += amount
        companies.append(
            {
                'company_id': str(company.id),
                'company_name': company.name,
                'status': company.status,
                'deal_count': deal_count,
                'total_deal_value': total_deal_value,
                'won_deal_value': won_deal_value,
                'active_deal_value': active_deal_value,
            }
        )

    companies.sort(key=lambda row: row['total_deal_value'], reverse=True)
    total = sum(row['total_deal_value'] for row in companies)
    top_customer_percentage = 0.0
    top_3_percentage = 0.0
    if total > 0:
        top_customer_percentage = round(companies[0]['total_deal_value'] / total * 100, 2)
        top_3_percentage = round(
            sum(row['total_deal_value'] for row in companies[:3]) / total * 100,
            2,
        )

    return {
        'report_type': 'customer_revenue',
        'generated_at': _generated_at(),
        'companies': companies,
        'top_customers': companies[:5],
        'concentration_risk': {
            'top_customer_percentage': top_customer_percentage,
            'top_3_percentage': top_3_percentage,
            'is_concentrated': top_customer_percentage > 40,
        },
    }
