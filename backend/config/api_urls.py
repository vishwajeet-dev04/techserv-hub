from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from apps.users.views import LoginView, LogoutView, MeView

urlpatterns = [
    path('health/', include('apps.dashboard.health_urls')),

    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='me'),

    path('users/', include('apps.users.urls')),
    path('companies/', include('apps.business.urls')),
    path('contacts/', include('apps.business.contact_urls')),
    path('deals/', include('apps.deals.urls')),
    path('finance/', include('apps.finance.urls')),
    path('dashboard/', include('apps.dashboard.urls')),
    path('reports/', include('apps.reports.urls')),
    path('pulse/', include('apps.pulse.urls')),
]