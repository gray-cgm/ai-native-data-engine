FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/opt/uv-venv

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5.7 /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml ./
COPY uv.lock ./
COPY apps/api/pyproject.toml apps/api/pyproject.toml
COPY apps/orchestrator/pyproject.toml apps/orchestrator/pyproject.toml
COPY python/core/pyproject.toml python/core/pyproject.toml
COPY python/adapters/pyproject.toml python/adapters/pyproject.toml
COPY python/workflows/pyproject.toml python/workflows/pyproject.toml
COPY python/profiles/pyproject.toml python/profiles/pyproject.toml
COPY python/services/pyproject.toml python/services/pyproject.toml
COPY sdk/python/pyproject.toml sdk/python/pyproject.toml

RUN uv sync --locked --package orchestrator --no-install-workspace

COPY apps/api/src apps/api/src
COPY apps/orchestrator/src apps/orchestrator/src
COPY python/core/src python/core/src
COPY python/adapters/src python/adapters/src
COPY python/workflows/src python/workflows/src
COPY python/profiles/src python/profiles/src
COPY python/services/src python/services/src
COPY sdk/python/src sdk/python/src
COPY infra infra
COPY examples examples
COPY data data

RUN uv sync --locked --package orchestrator
