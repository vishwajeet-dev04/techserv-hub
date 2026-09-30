# Deploying techserv-hub (Docker on the Azure VM)

Server: Ubuntu 24.04, user `azureuser`, `http://20.244.5.15`. Code lives in `~/techserv-hub` (branch `dev`).

Services (see `docker-compose.yml`): `postgres`, `redis`, `backend` (gunicorn), `celery-worker`, `celery-beat`, `nginx` (React build + reverse proxy on port 80). Uploaded files are stored in the `media` Docker volume and served by nginx at `/media/`.

Build one service at a time, then start it with `--no-build`. Do not run `docker compose up -d --build` for everything at once on this VM.

## First deploy

```bash
cd ~/techserv-hub
git pull

# 1. Create .env with fresh secrets (they are written to the file, never printed)
cp .env.example .env
sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')|" .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
chmod 600 .env
nano .env   # fill EMAIL_HOST_USER, EMAIL_HOST_PASSWORD (Gmail App Password), DEFAULT_FROM_EMAIL

# 2. Database and Redis
docker compose up -d postgres redis

# 3. Backend
docker compose build backend
docker compose up -d --no-build backend
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser

# 4. Celery worker and beat (same image as backend)
docker compose up -d --no-build celery-worker celery-beat

# 5. Frontend + nginx
docker compose build nginx
docker compose up -d --no-build nginx

# 6. Check
docker compose ps
curl -I http://localhost/
```

Open `http://20.244.5.15` and log in with the superuser (it is created with the ADMIN role).

## Updating after new commits

```bash
cd ~/techserv-hub
git pull
docker compose build backend
docker compose up -d --no-build backend celery-worker celery-beat
docker compose exec backend python manage.py migrate
docker compose build nginx
docker compose up -d --no-build nginx
```

Only frontend changed: run the last two lines. Only `nginx/nginx.conf` changed: `docker compose restart nginx`. Only `.env` changed: `docker compose up -d --no-build backend celery-worker celery-beat`.

## Everyday commands

```bash
docker compose ps                          # what is running
docker compose logs -f backend             # live logs (also: nginx, celery-worker, celery-beat)
docker compose restart backend             # restart one service
docker compose exec backend python manage.py shell
```

## Backups

```bash
# Database
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > ~/backup-$(date +%F).sql.gz

# Uploaded files
docker run --rm -v techserv-hub_media:/media -v ~/:/backup alpine tar czf /backup/media-$(date +%F).tar.gz -C /media .
```

Copy backups off the VM (Azure Backup or `scp`). Never run `docker compose down -v`: `-v` deletes the database and uploads.

## Settings that live only in the server `.env`

| Key | Value now | Notes |
|---|---|---|
| `SECRET_KEY` | generated | Never reuse the local one |
| `ALLOWED_HOSTS` | `20.244.5.15,localhost` | Add the domain later |
| `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` | `http://20.244.5.15` | Switch to `https://<domain>` later. `FRONTEND_URL` is the link in emails |
| `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` | `False` | Set `True` once HTTPS is live |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | generated password | Letters and digits only. Changing them after the first start needs a manual DB change |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL` | Gmail SMTP + App Password | Empty `EMAIL_HOST` = emails only go to the logs |

`DATABASE_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` and `DJANGO_SETTINGS_MODULE` are set in `docker-compose.yml`.

## Later

- **Domain + HTTPS:** point the domain to the VM, add a certificate (e.g. Certbot), open port 443, then update `ALLOWED_HOSTS`, the three URL keys and set both `*_COOKIE_SECURE=True`.
- **Azure Blob for uploads:** add `django-storages[azure]`, switch `STORAGES["default"]` in `config/settings/production.py`, and copy the existing `media` volume into the container with `azcopy`.
