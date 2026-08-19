from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.finance.models import FinancialPeriod
from apps.reports.services.report_service import (
    build_customer_revenue_report,
    build_financial_summary,
    build_monthly_summary,
    build_sales_pipeline_report,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_list(request):
    return Response({
        'reports': [
            {'id': 'monthly-summary', 'name': 'Monthly Business Summary', 'status': 'ready'},
            {'id': 'sales-pipeline', 'name': 'Sales Pipeline Report', 'status': 'ready'},
            {'id': 'financial-summary', 'name': 'Financial Summary', 'status': 'ready'},
            {'id': 'customer-revenue', 'name': 'Customer Revenue Report', 'status': 'ready'},
        ]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_summary_report(request):
    try:
        return Response(build_monthly_summary(request.query_params.get('period_id')))
    except FinancialPeriod.DoesNotExist:
        return Response(
            {'error': True, 'message': 'Financial period not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_pipeline_report(request):
    return Response(build_sales_pipeline_report())


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_summary_report(request):
    try:
        return Response(build_financial_summary(request.query_params.get('period_id')))
    except FinancialPeriod.DoesNotExist:
        return Response(
            {'error': True, 'message': 'Financial period not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_revenue_report(request):
    return Response(build_customer_revenue_report())
