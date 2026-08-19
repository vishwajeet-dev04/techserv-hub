import logging
from decimal import Decimal
from typing import Optional

from apps.finance.models import FinancialMetric, FinancialPeriod

logger = logging.getLogger(__name__)


def get_metric_value(period_id, metric_code: str) -> Decimal:
    try:
        metric = FinancialMetric.objects.filter(
            financial_period_id=period_id,
            metric_code=metric_code
        ).order_by('-created_at').first()
        return metric.value if metric else Decimal('0')
    except Exception as e:
        logger.error(f'Error fetching metric {metric_code} for period {period_id}: {e}')
        return Decimal('0')


def get_period_metrics(period_id) -> dict:
    metrics = FinancialMetric.objects.filter(
        financial_period_id=period_id
    ).values('metric_code', 'value', 'currency', 'source_reference', 'confidence', 'is_manual')

    return {m['metric_code']: m for m in metrics}


def calculate_profit_margin(period_id) -> Optional[float]:
    revenue = get_metric_value(period_id, 'revenue')
    net_profit = get_metric_value(period_id, 'net_profit')

    if revenue == 0:
        return None

    return float((net_profit / revenue) * 100)


def calculate_revenue_growth(current_period_id, previous_period_id) -> Optional[float]:
    current = get_metric_value(current_period_id, 'revenue')
    previous = get_metric_value(previous_period_id, 'revenue')

    if previous == 0:
        return None

    return float(((current - previous) / previous) * 100)


def get_financial_dashboard_summary(period_id) -> dict:
    metrics = get_period_metrics(period_id)

    def val(code):
        m = metrics.get(code)
        return float(m['value']) if m else 0.0

    revenue = val('revenue')
    net_profit = val('net_profit')

    profit_margin = None
    if revenue > 0:
        profit_margin = round((net_profit / revenue) * 100, 2)

    return {
        'revenue': revenue,
        'expenses': val('expenses'),
        'gross_profit': val('gross_profit'),
        'operating_profit': val('operating_profit'),
        'net_profit': net_profit,
        'cash': val('cash'),
        'receivables': val('receivables'),
        'payables': val('payables'),
        'assets': val('assets'),
        'liabilities': val('liabilities'),
        'equity': val('equity'),
        'profit_margin': profit_margin,
    }


def get_revenue_trend(limit: int = 6) -> list:
    recent_periods = FinancialPeriod.objects.order_by('-start_date')[:limit]

    trend = []
    for period in reversed(list(recent_periods)):
        revenue = get_metric_value(period.id, 'revenue')
        net_profit = get_metric_value(period.id, 'net_profit')
        trend.append({
            'period': period.label,
            'revenue': float(revenue),
            'net_profit': float(net_profit),
        })

    return trend