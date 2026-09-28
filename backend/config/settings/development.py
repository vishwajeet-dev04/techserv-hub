from .base import *  # noqa
from decouple import config

DEBUG = True

# Requests arrive through the Vite proxy with the browser's Host (LAN IP changes with DHCP).
ALLOWED_HOSTS = ['*']

# Vite uses 5173 by default and 5174+ if that port is taken.
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^http://localhost:\d+$',
    r'^http://127\.0\.0\.1:\d+$',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='techserv_db'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='postgres'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

EMAIL_BACKEND = (
    'django.core.mail.backends.smtp.EmailBackend'
    if config('EMAIL_HOST', default='')
    else 'django.core.mail.backends.console.EmailBackend'
)
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')
