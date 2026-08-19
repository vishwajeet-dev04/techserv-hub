import logging
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FinancialPeriod, FinancialDocument, FinancialMetric
from .serializers import (
    FinancialPeriodSerializer,
    FinancialDocumentSerializer,
    FinancialDocumentUploadSerializer,
    FinancialMetricSerializer
)
from .services.kpi_service import get_financial_dashboard_summary, get_revenue_trend
from common.permissions.roles import IsFinanceOrAbove

logger = logging.getLogger(__name__)


class FinancialPeriodListCreateView(generics.ListCreateAPIView):
    queryset = FinancialPeriod.objects.all().order_by('-start_date')
    serializer_class = FinancialPeriodSerializer
    permission_classes = [IsAuthenticated, IsFinanceOrAbove]


class FinancialPeriodDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = FinancialPeriod.objects.all()
    serializer_class = FinancialPeriodSerializer
    permission_classes = [IsAuthenticated, IsFinanceOrAbove]


class FinancialDocumentListView(generics.ListCreateAPIView):
    queryset = FinancialDocument.objects.select_related('financial_period', 'uploaded_by')
    permission_classes = [IsAuthenticated, IsFinanceOrAbove]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return FinancialDocumentUploadSerializer
        return FinancialDocumentSerializer

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
        logger.info(
            f'Document uploaded: {serializer.instance.file_name} by {self.request.user.email}'
        )


class FinancialDocumentDetailView(generics.RetrieveAPIView):
    queryset = FinancialDocument.objects.select_related('financial_period', 'uploaded_by')
    serializer_class = FinancialDocumentSerializer
    permission_classes = [IsAuthenticated, IsFinanceOrAbove]


class FinancialMetricListCreateView(generics.ListCreateAPIView):
    serializer_class = FinancialMetricSerializer
    permission_classes = [IsAuthenticated, IsFinanceOrAbove]

    def get_queryset(self):
        qs = FinancialMetric.objects.select_related('financial_period', 'source_document')
        period_id = self.request.query_params.get('period_id')
        if period_id:
            qs = qs.filter(financial_period_id=period_id)
        return qs.order_by('-financial_period__start_date', 'metric_code')

    def perform_create(self, serializer):
        serializer.save(
            is_manual=True,
            created_by=self.request.user
        )
        logger.info(
            f'Manual metric entry: {serializer.instance.metric_code} '
            f'by {self.request.user.email}'
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_summary(request):
    period_id = request.query_params.get('period_id')
    if not period_id:
        latest = FinancialPeriod.objects.order_by('-start_date').first()
        if not latest:
            return Response(
                {'detail': 'No financial periods found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        period_id = latest.id

    summary = get_financial_dashboard_summary(period_id)
    return Response(summary)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def revenue_trend(request):
    limit = int(request.query_params.get('limit', 6))
    return Response(get_revenue_trend(limit=limit))