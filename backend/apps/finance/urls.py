from django.urls import path
from .views import (
    FinancialPeriodListCreateView,
    FinancialPeriodDetailView,
    FinancialDocumentListView,
    FinancialDocumentDetailView,
    FinancialMetricListCreateView,
    financial_summary,
    revenue_trend,
)

urlpatterns = [
    path('periods/', FinancialPeriodListCreateView.as_view(), name='period-list-create'),
    path('periods/<uuid:pk>/', FinancialPeriodDetailView.as_view(), name='period-detail'),
    path('documents/', FinancialDocumentListView.as_view(), name='document-list'),
    path('documents/<uuid:pk>/', FinancialDocumentDetailView.as_view(), name='document-detail'),
    path('metrics/', FinancialMetricListCreateView.as_view(), name='metric-list-create'),
    path('summary/', financial_summary, name='financial-summary'),
    path('trend/', revenue_trend, name='revenue-trend'),
]