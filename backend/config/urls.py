from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('config.api_urls')),
]

if settings.DEBUG:
    # Exempt media from X-Frame-Options so the frontend can embed PDFs in an iframe.
    urlpatterns += [
        re_path(
            r'^media/(?P<path>.*)$',
            xframe_options_exempt(serve),
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]
