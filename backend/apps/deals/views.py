import logging
from django.http import Http404
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Deal
from .serializers import DealListSerializer, DealDetailSerializer, DealActivitySerializer
from .services.deal_service import get_deal, get_deal_activities, get_deal_list, get_pipeline_summary
from common.permissions.roles import IsSalesOrAbove

logger = logging.getLogger(__name__)


class DealListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsSalesOrAbove]

    def get_queryset(self):
        return get_deal_list(
            search=self.request.query_params.get('search'),
            stage=self.request.query_params.get('stage'),
            owner_id=self.request.query_params.get('owner_id'),
            company_id=self.request.query_params.get('company_id'),
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