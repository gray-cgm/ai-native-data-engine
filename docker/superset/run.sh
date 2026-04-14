#!/bin/sh
set -eu

/app/.venv/bin/superset db upgrade
/app/.venv/bin/superset fab create-admin \
  --username "${SUPERSET_ADMIN_USERNAME:-admin}" \
  --firstname Admin \
  --lastname User \
  --email "${SUPERSET_ADMIN_EMAIL:-admin@example.com}" \
  --password "${SUPERSET_ADMIN_PASSWORD:-admin}" || true
/app/.venv/bin/superset init
/app/.venv/bin/superset shell < /workspace/docker/superset/bootstrap.py
exec /app/.venv/bin/superset run -h 0.0.0.0 -p 8088
