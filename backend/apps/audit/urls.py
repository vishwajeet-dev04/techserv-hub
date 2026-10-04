from django.urls import path

from .views import ImportLogDetailView, ImportLogListView, import_log_file

urlpatterns = [
    path('imports/', ImportLogListView.as_view(), name='import-log-list'),
    path('imports/<uuid:pk>/', ImportLogDetailView.as_view(), name='import-log-detail'),
    path('imports/<uuid:pk>/file/', import_log_file, name='import-log-file'),
]
