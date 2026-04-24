"""Alembic environment for API metadata DB.

Reads DATABASE_URL from env (fallback to local SQLite under data/metadata/).
Target metadata is `src.models.base.Base.metadata` so autogenerate works for
all current + future tables under apps/api.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make `src.*` importable when running `alembic` from apps/api/ or repo root.
_APPS_API_ROOT = Path(__file__).resolve().parent.parent
if str(_APPS_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_APPS_API_ROOT))

from src.models.base import Base  # noqa: E402  (after sys.path mutation)
from src.models import requirement  # noqa: F401,E402 — ensure models are registered


config = context.config

# Resolve DB URL at runtime (respect DATABASE_URL env var; fallback to local SQLite).
_db_url = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(os.getcwd(), 'data', 'metadata', 'requirement.db')}",
)
config.set_main_option("sqlalchemy.url", _db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=_db_url.startswith("sqlite"),
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=_db_url.startswith("sqlite"),
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
