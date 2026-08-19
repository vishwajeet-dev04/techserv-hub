from django.urls import path
from .views import dashboard_summary, alerts_view

urlpatterns = [
    path('', dashboard_summary, name='dashboard-summary'),
    path('alerts/', alerts_view, name='dashboard-alerts'),
]
