import logging
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FinancialPeriod, FinancialDocument, FinancialMetric, MisUpload
from .models import CapitalEntry, CashflowEntry, ComplianceItem, Invoice, Payable, PurchaseOrder
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
    ComplianceItemSerializer,
    MisUploadSerializer,
)
from .services.kpi_service import get_financial_dashboard_summary, get_revenue_trend
from .services.ops_service import get_ops_dashboard_series, get_ops_summary
from .services.bank_position import get_bank_position
from .services.ledger_summary import (
    cashflow_summary,
    clients_summary,
    invoices_summary,
    payables_summary,
    purchase_orders_summary,
)
from common.permissions.roles import IsAdmin, IsFinanceOperator, IsFinanceOrAbove

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


def _apply_date_filters(qs, request, field: str):
    date_from = request.query_params.get('from')
    date_to = request.query_params.get('to')
    if date_from:
        qs = qs.filter(**{f'{field}__gte': date_from})
    if date_to:
        qs = qs.filter(**{f'{field}__lte': date_to})
    return qs


class PurchaseOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]

    def get_queryset(self):
        qs = PurchaseOrder.objects.select_related('company').prefetch_related('invoices')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        client = self.request.query_params.get('client')
        qs = _apply_date_filters(qs, self.request, 'po_date')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if client:
            qs = qs.filter(customer_name__icontains=client)
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
        client = self.request.query_params.get('client')
        qs = _apply_date_filters(qs, self.request, 'invoice_date')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if client:
            qs = qs.filter(customer_name__icontains=client)
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
        vendor = self.request.query_params.get('vendor')
        qs = _apply_date_filters(qs, self.request, 'due_date')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if vendor:
            qs = qs.filter(vendor__icontains=vendor)
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
        category = self.request.query_params.get('category')
        qs = _apply_date_filters(qs, self.request, 'entry_date')
        if direction:
            qs = qs.filter(direction=direction)
        if category:
            qs = qs.filter(category__icontains=category)
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


class ComplianceItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ComplianceItemSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]

    def get_queryset(self):
        from django.db.models import Q

        qs = ComplianceItem.objects.select_related('created_by')
        status_filter = self.request.query_params.get('status')
        act = self.request.query_params.get('act')
        search = self.request.query_params.get('search')
        month = self.request.query_params.get('month')  # YYYY-MM
        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if act:
            qs = qs.filter(applicable_act__icontains=act)
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(form_name__icontains=search)
                | Q(applicable_act__icontains=search)
            )
        if month:
            try:
                year_s, month_s = month.split('-', 1)
                y, m = int(year_s), int(month_s)
                qs = qs.filter(period_month__year=y, period_month__month=m)
            except (ValueError, TypeError):
                pass
        if date_from or date_to:
            due_q = Q()
            period_q = Q()
            if date_from:
                due_q &= Q(due_date__gte=date_from)
                period_q &= Q(period_month__gte=date_from)
            if date_to:
                due_q &= Q(due_date__lte=date_to)
                period_q &= Q(period_month__lte=date_to)
            qs = qs.filter(
                (Q(due_date__isnull=False) & due_q)
                | (Q(due_date__isnull=True) & period_q)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ComplianceItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ComplianceItem.objects.select_related('created_by')
    serializer_class = ComplianceItemSerializer
    permission_classes = [IsAuthenticated, IsFinanceOperator]


class MisUploadListCreateView(generics.ListCreateAPIView):
    queryset = MisUpload.objects.select_related('uploaded_by')
    serializer_class = MisUploadSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
        logger.info('MIS file uploaded: %s user=%s path=%s', serializer.instance.file_name, self.request.user.id, self.request.path)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ops_summary(request):
    return Response(get_ops_summary(
        request.query_params.get('from'),
        request.query_params.get('to'),
    ))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ops_dashboard_series(request):
    return Response(get_ops_dashboard_series(
        request.query_params.get('from'),
        request.query_params.get('to'),
    ))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bank_position(request):
    date_from = request.query_params.get('from')
    date_to = request.query_params.get('to')
    return Response(get_bank_position(date_from, date_to))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFinanceOperator])
def ledger_page_summary(request):
    page = (request.query_params.get('page') or 'cashflow').lower()
    date_from = request.query_params.get('from')
    date_to = request.query_params.get('to')
    if page == 'cashflow':
        return Response(cashflow_summary(date_from, date_to))
    if page == 'payables':
        return Response(payables_summary(date_from, date_to))
    if page == 'invoices':
        return Response(invoices_summary(date_from, date_to))
    if page == 'clients':
        return Response(clients_summary())
    if page in {'purchase-orders', 'pos', 'po'}:
        return Response(purchase_orders_summary())
    return Response({'error': True, 'message': 'Unknown page.'}, status=status.HTTP_400_BAD_REQUEST)
