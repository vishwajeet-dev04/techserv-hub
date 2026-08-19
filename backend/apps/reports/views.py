from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_list(request):
    return Response({
        'reports': [
            {'id': 'monthly-summary', 'name': 'Monthly Business Summary', 'status': 'coming_soon'},
            {'id': 'sales-pipeline', 'name': 'Sales Pipeline Report', 'status': 'coming_soon'},
            {'id': 'financial-summary', 'name': 'Financial Summary', 'status': 'coming_soon'},
            {'id': 'customer-revenue', 'name': 'Customer Revenue Report', 'status': 'coming_soon'},
        ]
    })