import sys
import tempfile
from pathlib import Path
from datetime import timedelta

from celery.schedules import crontab
from decouple import config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY')

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
]

LOCAL_APPS = [
    'apps.users',
    'apps.business',
    'apps.deals',
    'apps.finance',
    'apps.documents',
    'apps.dashboard',
    'apps.reports',
    'apps.audit',
    'apps.pulse',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'users.User'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

TESTING = len(sys.argv) > 1 and sys.argv[1] == 'test'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
if TESTING:
    MEDIA_ROOT = Path(tempfile.mkdtemp(prefix='techserv-test-media-'))


def _azure_connection_parts(connection_string: str) -> dict:
    parts = dict(
        item.split('=', 1) for item in connection_string.strip().strip(';').split(';') if '=' in item
    )
    return {
        'account_name': parts.get('AccountName', ''),
        'account_key': parts.get('AccountKey', ''),
        'endpoint_suffix': parts.get('EndpointSuffix', 'core.windows.net'),
    }


STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}

# Uploaded files go to Azure Blob when AZURE_CONTAINER is set (one private container per
# environment, e.g. media-dev locally and media-prod on the server); otherwise MEDIA_ROOT.
AZURE_CONTAINER = '' if TESTING else config('AZURE_CONTAINER', default='').strip()
if AZURE_CONTAINER:
    _azure = _azure_connection_parts(config('AZURE_CONNECTION_STRING', default=''))
    _azure['account_name'] = config('AZURE_ACCOUNT_NAME', default='') or _azure['account_name']
    _azure['account_key'] = config('AZURE_ACCOUNT_KEY', default='') or _azure['account_key']
    if not (_azure['account_name'] and _azure['account_key']):
        raise ImproperlyConfigured(
            'AZURE_CONTAINER is set but the storage account is not: set AZURE_ACCOUNT_NAME and '
            'AZURE_ACCOUNT_KEY, or AZURE_CONNECTION_STRING.'
        )
    STORAGES['default'] = {
        'BACKEND': 'storages.backends.azure_storage.AzureStorage',
        'OPTIONS': {
            **_azure,
            'azure_container': AZURE_CONTAINER,
            'expiration_secs': config('AZURE_URL_EXPIRATION_SECS', default=3600, cast=int),
            'overwrite_files': False,
        },
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'common.pagination.pagination.StandardResultsPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ),
    'EXCEPTION_HANDLER': 'common.exceptions.handlers.custom_exception_handler',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in config('CORS_ALLOWED_ORIGINS', default='http://localhost:5173').split(',')
    if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True

FILE_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024

CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60

CELERY_BEAT_SCHEDULE = {
    'pulse-opportunity-date-reminders-daily': {
        'task': 'pulse.send_opportunity_date_reminders',
        'schedule': crontab(hour=9, minute=0),
    },
    'finance-payable-due-reminders-daily': {
        'task': 'finance.send_payable_due_reminders',
        'schedule': crontab(hour=9, minute=0),
    },
    'finance-invoice-due-reminders-daily': {
        'task': 'finance.send_invoice_due_reminders',
        'schedule': crontab(hour=9, minute=0),
    },
    'finance-compliance-due-reminders-daily': {
        'task': 'finance.send_compliance_due_reminders',
        'schedule': crontab(hour=9, minute=0),
    },
}

FRONTEND_URL = config('FRONTEND_URL', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@techserv.local')
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'apps': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
        'celery': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        # The Azure SDK logs every HTTP request/response at INFO.
        'azure': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
    },
}