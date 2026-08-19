from django.urls import path
from .views import DealListCreateView, DealDetailView, DealActivityListCreateView, pipeline_summary

urlpatterns = [
    path('', DealListCreateView.as_view(), name='deal-list-create'),
    path('pipeline/summary/', pipeline_summary, name='pipeline-summary'),
    path('<uuid:pk>/', DealDetailView.as_view(), name='deal-detail'),
    path('<uuid:deal_id>/activities/', DealActivityListCreateView.as_view(), name='deal-activities'),
]