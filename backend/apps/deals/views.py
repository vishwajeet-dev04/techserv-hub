import logging
from django.http import Http404, HttpResponse
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.imports import record_import
from apps.audit.models import ImportModule
from .models import Deal, PoDocumentIssue, PoWorkflow
from .po_constants import MAX_IMPORT_BYTES, PO_ISSUE_REASONS
from .po_issue_service import create_po_issue, list_po_issues, resolve_po_issue
from .po_service import (
    approve_po_workflow,
    create_po_workflow,
    delete_po_workflow,
    export_po_xlsx,
    get_po_workflow,
    import_po_xlsx,
    list_po_workflows,
    po_dashboard,
    template_po_xlsx,
    update_po_workflow,
)
from .serializers import (
    DealActivitySerializer,
    DealDetailSerializer,
    DealListSerializer,
    PoDocumentIssueSerializer,
    PoWorkflowSerializer,
)
from .services.deal_service import get_deal, get_deal_activities, get_deal_list, get_pipeline_summary
from common.permissions.roles import IsManagementOrAbove, IsSalesOrAbove

logger = logging.getLogger(__name__)


class DealListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_queryset(self):
        return get_deal_list(
            search=self.request.query_params.get('search'),
            stage=self.request.query_params.get('stage'),
            owner_id=self.request.query_params.get('owner_id'),
            company_id=self.request.query_params.get('company_id'),
            service_pillar=self.request.query_params.get('service_pillar'),
            source=self.request.query_params.get('source'),
        )

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DealDetailSerializer
        return DealListSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
        logger.info(f'Deal created: {serializer.instance.name} by {self.request.user.email}')


class DealDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DealDetailSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_queryset(self):
        return Deal.objects.select_related('company', 'owner').prefetch_related('activities')

    def get_object(self):
        try:
            obj = get_deal(self.kwargs['pk'])
        except Deal.DoesNotExist as exc:
            raise Http404('Deal not found.') from exc
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_update(self, serializer):
        old_stage = self.get_object().stage
        instance = serializer.save()
        new_stage = instance.stage
        if old_stage != new_stage:
            logger.info(
                f'Deal stage changed: {instance.name} '
                f'{old_stage} -> {new_stage} by {self.request.user.email}'
            )


class DealActivityListCreateView(generics.ListCreateAPIView):
    serializer_class = DealActivitySerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_queryset(self):
        return get_deal_activities(self.kwargs['deal_id'])

    def perform_create(self, serializer):
        serializer.save(
            deal_id=self.kwargs['deal_id'],
            created_by=self.request.user
        )
        logger.info(
            f'Deal activity created: {serializer.instance.type} '
            f'on {serializer.instance.deal_id} by {self.request.user.email}'
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pipeline_summary(request):
    return Response(get_pipeline_summary())


XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def _xlsx_response(content: bytes, filename: str) -> HttpResponse:
    response = HttpResponse(content, content_type=XLSX_TYPE)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def _read_upload(request):
    upload = request.FILES.get('file')
    if upload is None:
        return None, Response(
            {'error': True, 'message': 'Choose an Excel (.xlsx) file.', 'details': None},
            status=status.HTTP_400_BAD_REQUEST,
        )
    name = (upload.name or '').lower()
    if not name.endswith('.xlsx'):
        return None, Response(
            {'error': True, 'message': 'Only .xlsx files are accepted.', 'details': None},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if upload.size and upload.size > MAX_IMPORT_BYTES:
        return None, Response(
            {'error': True, 'message': 'File is too large (max 2 MB).', 'details': None},
            status=status.HTTP_400_BAD_REQUEST,
        )
    content = upload.read()
    if len(content) > MAX_IMPORT_BYTES:
        return None, Response(
            {'error': True, 'message': 'File is too large (max 2 MB).', 'details': None},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return content, None


class PoWorkflowListCreateView(generics.ListCreateAPIView):
    serializer_class = PoWorkflowSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_queryset(self):
        params = self.request.query_params
        return list_po_workflows(
            search=params.get('search'),
            date_from=params.get('from'),
            date_to=params.get('to'),
            customer=params.get('customer'),
            billing_entity=params.get('billing_entity'),
            opportunity=params.get('opportunity'),
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        customer_name = data.pop('customer_name_input', '') or data.pop('customer_name', '') or request.data.get('customer_name', '')
        instance = create_po_workflow(customer_name=str(customer_name), **data)
        logger.info('PO workflow created: %s user=%s path=%s', instance.po_number, request.user.id, request.path)
        return Response(PoWorkflowSerializer(instance).data, status=status.HTTP_201_CREATED)


class PoWorkflowDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PoWorkflowSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_object(self):
        try:
            return get_po_workflow(self.kwargs['pk'])
        except PoWorkflow.DoesNotExist as exc:
            raise Http404('PO workflow row not found.') from exc

    def perform_update(self, serializer):
        data = serializer.validated_data
        customer_name = data.pop('customer_name_input', None)
        if customer_name is None:
            customer_name = data.pop('customer_name', None)
        if customer_name is None and 'customer_name' in self.request.data:
            customer_name = self.request.data.get('customer_name')
        update_po_workflow(serializer.instance, customer_name=customer_name, **data)

    def perform_destroy(self, instance):
        delete_po_workflow(instance)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSalesOrAbove])
def po_workflow_approve(request, pk):
    try:
        instance = get_po_workflow(pk)
    except PoWorkflow.DoesNotExist as exc:
        raise Http404('PO workflow row not found.') from exc
    approved = approve_po_workflow(instance, user=request.user)
    logger.info('PO workflow approved: %s user=%s', approved.po_number, request.user.id)
    return Response(PoWorkflowSerializer(approved).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSalesOrAbove])
def po_workflow_dashboard(request):
    return Response(
        po_dashboard(
            date_from=request.query_params.get('from'),
            date_to=request.query_params.get('to'),
            customer=request.query_params.get('customer'),
            billing_entity=request.query_params.get('billing_entity'),
            search=request.query_params.get('search'),
        )
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSalesOrAbove])
def po_workflow_export(request):
    return _xlsx_response(export_po_xlsx(), 'po-workflow.xlsx')


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSalesOrAbove])
def po_workflow_template(request):
    return _xlsx_response(template_po_xlsx(), 'po-workflow-template.xlsx')


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSalesOrAbove])
@parser_classes([MultiPartParser, FormParser])
def po_workflow_import(request):
    content, error = _read_upload(request)
    if error is not None:
        return error
    result = import_po_xlsx(content)
    record_import(request, ImportModule.PO_WORKFLOW, content, result)
    logger.info(
        'PO workflow imported created=%s errors=%s user=%s path=%s',
        result['created'], len(result['errors']), request.user.id, request.path,
    )
    return Response(result)


class PoDocumentIssueListCreateView(generics.ListCreateAPIView):
    serializer_class = PoDocumentIssueSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]
    pagination_class = None

    def get_queryset(self):
        params = self.request.query_params
        return list_po_issues(opportunity=params.get('opportunity'), status=params.get('status'))

    def create(self, request, *args, **kwargs):
        data = request.data
        issue = create_po_issue(
            opportunity_id=data.get('opportunity'),
            reasons=data.get('reasons') or [],
            attachment_ids=data.get('attachment_ids') or [],
            note=data.get('note') or '',
            actor=request.user,
        )
        logger.info('PO document issue raised: %s opportunity=%s user=%s', issue.pk, issue.opportunity_id, request.user.id)
        issue = list_po_issues().get(pk=issue.pk)
        return Response(PoDocumentIssueSerializer(issue).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSalesOrAbove])
def po_issue_reasons(request):
    return Response([{'code': code, 'label': label} for code, label in PO_ISSUE_REASONS.items()])


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManagementOrAbove])
def po_issue_resolve(request, pk):
    try:
        issue = list_po_issues().get(pk=pk)
    except PoDocumentIssue.DoesNotExist as exc:
        raise Http404('Issue not found.') from exc
    resolved = resolve_po_issue(issue, actor=request.user, resolution_note=request.data.get('resolution_note') or '')
    logger.info('PO document issue resolved manually: %s user=%s', resolved.pk, request.user.id)
    return Response(PoDocumentIssueSerializer(resolved).data)