from azure.core.exceptions import ResourceNotFoundError
from django.http import FileResponse, Http404
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from common.permissions.roles import IsManagementOrAbove

from .models import ImportLog, ImportModule
from .serializers import ImportLogDetailSerializer, ImportLogSerializer


class ImportLogListView(generics.ListAPIView):
    serializer_class = ImportLogSerializer
    permission_classes = [IsAuthenticated, IsManagementOrAbove]

    def get_queryset(self):
        queryset = ImportLog.objects.select_related('uploaded_by')
        module = (self.request.query_params.get('module') or '').upper()
        if module in ImportModule.values:
            queryset = queryset.filter(module=module)
        return queryset


class ImportLogDetailView(generics.RetrieveAPIView):
    queryset = ImportLog.objects.select_related('uploaded_by')
    serializer_class = ImportLogDetailSerializer
    permission_classes = [IsAuthenticated, IsManagementOrAbove]


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagementOrAbove])
def import_log_file(request, pk):
    log = generics.get_object_or_404(ImportLog, pk=pk)
    if not log.file or not log.file.storage.exists(log.file.name):
        raise Http404('The original file is not available.')
    try:
        handle = log.file.open('rb')
    except (FileNotFoundError, ResourceNotFoundError):
        raise Http404('The original file is not available.')
    return FileResponse(handle, as_attachment=True, filename=log.file_name)
