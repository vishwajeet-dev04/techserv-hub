FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

RUN useradd --create-home --uid 1000 app

COPY --chown=app:app . .

# Static files are baked into the image (served by WhiteNoise); the dummy values only satisfy settings import.
RUN DJANGO_SETTINGS_MODULE=config.settings.production \
    SECRET_KEY=collectstatic-only \
    DATABASE_URL=sqlite:////tmp/collectstatic.db \
    ALLOWED_HOSTS=localhost \
    FRONTEND_URL=http://localhost \
    python manage.py collectstatic --noinput

# Named volumes copy this ownership on first mount, so the non-root user can write uploads.
RUN mkdir -p /app/media && chown -R app:app /app/media /app/staticfiles

USER app

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "--access-logfile", "-"]
