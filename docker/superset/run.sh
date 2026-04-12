#!/bin/sh
set -eu

pip install --no-cache-dir psycopg2-binary duckdb duckdb-engine >/tmp/superset-bootstrap.log 2>&1

superset db upgrade
superset fab create-admin \
  --username "${SUPERSET_ADMIN_USERNAME:-admin}" \
  --firstname Admin \
  --lastname User \
  --email "${SUPERSET_ADMIN_EMAIL:-admin@example.com}" \
  --password "${SUPERSET_ADMIN_PASSWORD:-admin}" || true
superset init
superset shell < /workspace/docker/superset/bootstrap.py
exec superset run -h 0.0.0.0 -p 8088
