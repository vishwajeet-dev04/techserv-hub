import logging
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FinancialPeriod, FinancialDocument, FinancialMetric
from .models import CapitalEntry, CashflowEntry, Invoice, Payable, PurchaseOrder
from .serializers import (
    FinancialPeriodSerializer,
    FinancialDocumentSerializer,
    FinancialDocumentUploadSerializer,
    FinancialMetricSerializer,
    PurchaseOrderSerializer,
    InvoiceSerializer,
    PayableSerializer,
    CashflowEntrySerializer,
    CapitalEntrySerializer,
)
from .services.kpi_service import get_financial_dashboard_summary, get_revenue_trend
from .services.ops_service import get_ops_summary
from common.permissions.roles import IsFinanceOperator, IsFinanceOrAbove

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


class FinancialMetricDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = FinancialMetric.objects.select_related('financial_period', 'source_document')
    serializer_class = FinancialMetricSerializer
    permission_classes = [IsAuthenticated, IsFinanceOrAbove]

    def perform_update(self, serializer):
        serializer.save(is_manual=True)
        logger.info(
            f'Manual metric updated: {serializer.instance.metric_code} '
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


class PurchaseOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]

    def get_queryset(self):
        qs = PurchaseOrder.objects.select_related('company').prefetch_related('invoices')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(customer_name__icontains=search)
        return qs


class PurchaseOrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PurchaseOrder.objects.select_related('company').prefetch_related('invoices')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]


class InvoiceListCreateView(generics.ListCreateAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]

    def get_queryset(self):
        qs = Invoice.objects.select_related('company', 'purchase_order')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(customer_name__icontains=search)
        return qs


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Invoice.objects.select_related('company', 'purchase_order')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]


class PayableListCreateView(generics.ListCreateAPIView):
    serializer_class = PayableSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]

    def get_queryset(self):
        qs = Payable.objects.all()
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(vendor__icontains=search)
        return qs


class PayableDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Payable.objects.all()
    serializer_class = PayableSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]


class CashflowEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = CashflowEntrySerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]

    def get_queryset(self):
        qs = CashflowEntry.objects.all()
        direction = self.request.query_params.get('direction')
        search = self.request.query_params.get('search')
        if direction:
            qs = qs.filter(direction=direction)
        if search:
            qs = qs.filter(category__icontains=search)
        return qs


class CashflowEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CashflowEntry.objects.all()
    serializer_class = CashflowEntrySerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]


class CapitalEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = CapitalEntrySerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]

    def get_queryset(self):
        qs = CapitalEntry.objects.all()
        capital_type = self.request.query_params.get('capital_type')
        if capital_type:
            qs = qs.filter(capital_type=capital_type)
        return qs


class CapitalEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CapitalEntry.objects.all()
    serializer_class = CapitalEntrySerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ops_summary(request):
    return Response(get_ops_summary())
