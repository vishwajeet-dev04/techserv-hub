import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.business.services.company_service import get_company_stats
from apps.deals.services.deal_service import get_pipeline_summary
from apps.finance.models import FinancialPeriod
from apps.finance.services.kpi_service import get_financial_dashboard_summary, get_revenue_trend

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    latest_period = FinancialPeriod.objects.order_by('-start_date').first()
    period_id = latest_period.id if latest_period else None
    period_label = latest_period.label if latest_period else None

    company_stats = get_company_stats()
    pipeline = get_pipeline_summary()
    financial = (
        get_financial_dashboard_summary(period_id)
        if period_id
        else {
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
    )
    trend = get_revenue_trend(limit=6)

    return Response({
        'period': period_label,
        'business': company_stats,
        'pipeline': pipeline,
        'financial': financial,
        'revenue_trend': trend,
    })