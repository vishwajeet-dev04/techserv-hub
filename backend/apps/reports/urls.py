from django.urls import path
from .views import (
    report_list,
    monthly_summary_report,
    sales_pipeline_report,
    financial_summary_report,
    customer_revenue_report,
)

urlpatterns = [
    path('', report_list, name='report-list'),
    path('monthly-summary/', monthly_summary_report, name='report-monthly-summary'),
    path('sales-pipeline/', sales_pipeline_report, name='report-sales-pipeline'),
    path('financial-summary/', financial_summary_report, name='report-financial-summary'),
    path('customer-revenue/', customer_revenue_report, name='report-customer-revenue'),
]
