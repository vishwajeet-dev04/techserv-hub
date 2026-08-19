import logging
from django.http import Http404
from django.db.models import Q
from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Company, Contact
from .serializers import CompanyListSerializer, CompanyDetailSerializer, ContactSerializer
from .services.company_service import get_company, get_company_list
from common.permissions.roles import IsSalesOrAbove

logger = logging.getLogger(__name__)


class CompanyListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsSalesOrAbove]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'status', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return get_company_list(
            search=self.request.query_params.get('search'),
            status=self.request.query_params.get('status'),
            owner_id=self.request.query_params.get('owner_id'),
        )

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CompanyDetailSerializer
        return CompanyListSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
        logger.info(f'Company created: {serializer.instance.name} by {self.request.user.email}')


class CompanyDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CompanyDetailSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_queryset(self):
        return Company.objects.select_related('owner').prefetch_related('contacts')

    def get_object(self):
        try:
            obj = get_company(self.kwargs['pk'])
        except Company.DoesNotExist as exc:
            raise Http404('Company not found.') from exc
        self.check_object_permissions(self.request, obj)
        return obj

    def destroy(self, request, *args, **kwargs):
        company = self.get_object()
        company.status = 'INACTIVE'
        company.save()
        logger.info(f'Company deactivated: {company.name} by {request.user.email}')
        return Response({'detail': 'Company marked as inactive.'}, status=status.HTTP_200_OK)


class ContactListCreateView(generics.ListCreateAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_queryset(self):
        company_id = self.kwargs.get('company_id')
        search = self.request.query_params.get('search')

        qs = Contact.objects.select_related('company')

        if company_id:
            qs = qs.filter(company_id=company_id)

        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )

        return qs.order_by('first_name', 'last_name')

    def perform_create(self, serializer):
        company_id = self.kwargs.get('company_id')
        if company_id:
            serializer.save(company_id=company_id)
        else:
            serializer.save()
        logger.info(
            f'Contact created: {serializer.instance.full_name} '
            f'by {self.request.user.email}'
        )


class ContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Contact.objects.select_related('company')
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAbove]