import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.dashboard.services.alert_service import get_management_alerts
from apps.dashboard.services.dashboard_service import get_dashboard_summary

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    return Response(get_dashboard_summary())


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alerts_view(request):
    return Response(get_management_alerts())
