from django.urls import path
from .views import UserListCreateView, UserDetailView, UserSetPasswordView

urlpatterns = [
    path('', UserListCreateView.as_view(), name='user-list-create'),
    path('<uuid:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('<uuid:pk>/set-password/', UserSetPasswordView.as_view(), name='user-set-password'),
]