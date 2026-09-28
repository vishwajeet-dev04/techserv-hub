from django.urls import path
from .views import (
    DealListCreateView,
    DealDetailView,
    DealActivityListCreateView,
    PoWorkflowListCreateView,
    PoWorkflowDetailView,
    pipeline_summary,
    po_workflow_approve,
    po_workflow_dashboard,
    po_workflow_export,
    po_workflow_import,
    po_workflow_template,
)

urlpatterns = [
    path('', DealListCreateView.as_view(), name='deal-list-create'),
    path('pipeline/summary/', pipeline_summary, name='pipeline-summary'),
    path('po-workflow/', PoWorkflowListCreateView.as_view(), name='po-workflow-list'),
    path('po-workflow/dashboard/', po_workflow_dashboard, name='po-workflow-dashboard'),
    path('po-workflow/export/', po_workflow_export, name='po-workflow-export'),
    path('po-workflow/template/', po_workflow_template, name='po-workflow-template'),
    path('po-workflow/import/', po_workflow_import, name='po-workflow-import'),
    path('po-workflow/<uuid:pk>/approve/', po_workflow_approve, name='po-workflow-approve'),
    path('po-workflow/<uuid:pk>/', PoWorkflowDetailView.as_view(), name='po-workflow-detail'),
    path('<uuid:pk>/', DealDetailView.as_view(), name='deal-detail'),
    path('<uuid:deal_id>/activities/', DealActivityListCreateView.as_view(), name='deal-activities'),
]