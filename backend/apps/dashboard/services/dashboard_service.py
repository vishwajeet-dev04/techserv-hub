import logging

from apps.business.services.company_service import get_company_stats
from apps.deals.services.deal_service import (
    count_deals_closing_within,
    count_overdue_deals,
    get_pipeline_summary,
)
from apps.finance.models import FinancialPeriod
from apps.finance.services.kpi_service import get_financial_dashboard_summary, get_revenue_trend

logger = logging.getLogger(__name__)

EMPTY_FINANCIAL = {
    'revenue': 0,
    'expenses': 0,
    'gross_profit': 0,
    'operating_profit': 0,
    'net_profit': 0,
    'cash': 0,
    'receivables': 0,
    'payables': 0,
    'assets': 0,
    'liabilities': 0,
    'equity': 0,
    'profit_margin': None,
}


def get_dashboard_summary() -> dict:
    latest_period = FinancialPeriod.objects.order_by('-start_date').first()
    period_id = latest_period.id if latest_period else None
    period_label = latest_period.label if latest_period else None

    pipeline = get_pipeline_summary()
    financial = (
        get_financial_dashboard_summary(period_id)
        if period_id
        else dict(EMPTY_FINANCIAL)
    )

    return {
        'period': period_label,
        'latest_period': period_label,
        'business': get_company_stats(),
        'pipeline': pipeline,
        'financial': financial,
        'revenue_trend': get_revenue_trend(limit=6),
        'active_deals_count': pipeline['active_deals_count'],
        'overdue_deals_count': count_overdue_deals(),
        'deals_closing_this_week': count_deals_closing_within(7),
    }
