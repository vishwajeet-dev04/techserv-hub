import logging
from datetime import timedelta
from decimal import Decimal

from django.db.models import Max, Q
from django.utils import timezone

from apps.deals.services.deal_service import get_active_deals, get_pipeline_summary
from apps.finance.models import FinancialPeriod
from apps.finance.services.kpi_service import get_metric_value, monthly_revenue_equivalent

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {'critical': 0, 'warning': 1, 'info': 2}


def _deals_closing_soon(today):
    qs = get_active_deals().filter(
        expected_close_date__gte=today,
        expected_close_date__lte=today + timedelta(days=7),
    )
    count = qs.count()
    if count == 0:
        return None
    deals = qs.order_by('expected_close_date')[:50]
    return {
        'type': 'deals_closing_soon',
        'severity': 'warning',
        'title': f'{count} deal{"s" if count != 1 else ""} closing this week',
        'description': 'These deals are expected to close within the next 7 days.',
        'count': count,
        'data': [
            {
                'id': str(deal.id),
                'name': deal.name,
                'company_name': deal.company.name,
                'value': float(deal.value),
                'expected_close_date': deal.expected_close_date.isoformat(),
            }
            for deal in deals
        ],
    }


def _deals_no_activity(today):
    cutoff = today - timedelta(days=30)
    qs = (
        get_active_deals()
        .annotate(latest_activity=Max('activities__activity_date'))
        .filter(Q(latest_activity__isnull=True) | Q(latest_activity__lt=cutoff))
    )
    count = qs.count()
    if count == 0:
        return None
    rows = []
    for deal in qs.order_by('latest_activity', 'name')[:50]:
        latest = deal.latest_activity
        if latest:
            days_since = (today - latest).days
        else:
            days_since = (today - deal.created_at.date()).days
        rows.append({
            'id': str(deal.id),
            'name': deal.name,
            'company_name': deal.company.name,
            'stage': deal.stage,
            'days_since_activity': days_since,
        })
    severity = 'critical' if count > 5 else 'warning'
    return {
        'type': 'deals_no_activity',
        'severity': severity,
        'title': f'{count} deal{"s" if count != 1 else ""} with no recent activity',
        'description': 'These active deals have had no logged activity in the last 30 days.',
        'count': count,
        'data': rows,
    }


def _overdue_deals(today):
    qs = get_active_deals().filter(expected_close_date__lt=today)
    count = qs.count()
    if count == 0:
        return None
    deals = qs.order_by('expected_close_date')[:50]
    return {
        'type': 'overdue_deals',
        'severity': 'critical',
        'title': f'{count} overdue deal{"s" if count != 1 else ""}',
        'description': 'These deals have passed their expected close date and are still open.',
        'count': count,
        'data': [
            {
                'id': str(deal.id),
                'name': deal.name,
                'company_name': deal.company.name,
                'stage': deal.stage,
                'expected_close_date': deal.expected_close_date.isoformat(),
                'days_overdue': (today - deal.expected_close_date).days,
            }
            for deal in deals
        ],
    }


def _high_receivables(period):
    if period is None:
        return None
    revenue = get_metric_value(period.id, 'revenue')
    receivables = get_metric_value(period.id, 'receivables')
    if revenue <= 0:
        return None
    percentage = float((receivables / revenue) * 100)
    if percentage <= 20:
        return None
    severity = 'critical' if percentage > 30 else 'warning'
    return {
        'type': 'high_receivables',
        'severity': severity,
        'title': f'Receivables are {percentage:.1f}% of revenue',
        'description': f'Receivables versus revenue for {period.label} exceed the 20% threshold.',
        'count': 1,
        'data': [{
            'is_alert': True,
            'receivables': float(receivables),
            'revenue': float(revenue),
            'percentage': round(percentage, 2),
        }],
    }


def _pipeline_health(period):
    if period is None:
        return None
    pipeline = get_pipeline_summary()
    weighted = Decimal(str(pipeline['weighted_pipeline']))
    revenue = get_metric_value(period.id, 'revenue')
    monthly_revenue = monthly_revenue_equivalent(period, revenue)
    if monthly_revenue <= 0:
        return None
    ratio = float(weighted / monthly_revenue)
    if ratio >= 0.5:
        return None
    return {
        'type': 'pipeline_health',
        'severity': 'warning',
        'title': 'Weighted pipeline is below half of monthly revenue',
        'description': 'Coverage is thin relative to current monthly revenue. Review active opportunities.',
        'count': 1,
        'data': [{
            'is_alert': True,
            'weighted_pipeline': float(weighted),
            'monthly_revenue': float(monthly_revenue),
            'ratio': round(ratio, 4),
        }],
    }


def get_management_alerts() -> dict:
    today = timezone.now().date()
    latest_period = FinancialPeriod.objects.order_by('-start_date').first()

    alerts = [
        alert
        for alert in (
            _overdue_deals(today),
            _deals_no_activity(today),
            _high_receivables(latest_period),
            _deals_closing_soon(today),
            _pipeline_health(latest_period),
        )
        if alert
    ]
    alerts.sort(key=lambda item: SEVERITY_ORDER.get(item['severity'], 9))

    critical_count = sum(1 for item in alerts if item['severity'] == 'critical')
    warning_count = sum(1 for item in alerts if item['severity'] == 'warning')
    info_count = sum(1 for item in alerts if item['severity'] == 'info')

    logger.info(
        'Management alerts computed: total=%s critical=%s warning=%s',
        len(alerts),
        critical_count,
        warning_count,
    )

    return {
        'alerts': alerts,
        'total_alerts': len(alerts),
        'critical_count': critical_count,
        'warning_count': warning_count,
        'info_count': info_count,
    }
