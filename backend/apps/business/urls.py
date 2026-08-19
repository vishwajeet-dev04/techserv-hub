from django.urls import path
from .views import CompanyListCreateView, CompanyDetailView, ContactListCreateView

urlpatterns = [
    path('', CompanyListCreateView.as_view(), name='company-list-create'),
    path('<uuid:pk>/', CompanyDetailView.as_view(), name='company-detail'),
    path('<uuid:company_id>/contacts/', ContactListCreateView.as_view(), name='company-contacts'),
]