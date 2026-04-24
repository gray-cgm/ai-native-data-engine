"""数据库连接管理模块

设计取舍：
- 采用 SQLAlchemy 2.0 声明式风格，兼顾类型安全与开发体验
- 支持 PostgreSQL（生产）和 SQLite（本地开发）双引擎，通过 DATABASE_URL 环境变量切换
- 默认走 SQLite 便于零配置启动，与现有 local-dev profile 保持一致
- 启动时自动建表（create_all），后续可平滑迁移至 Alembic
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(os.getcwd(), 'data', 'metadata', 'requirement.db')}",
)

# SQLite 需要 check_same_thread=False 才能在 FastAPI 的线程池中正常工作
_connect_args: dict = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_DEBUG", "").lower() == "true",
    connect_args=_connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI 依赖注入：每个请求一个数据库会话，请求结束自动关闭"""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """启动时确保数据库 schema 处于最新状态。

    策略（本地开发友好、生产可控）：
    1) 如果数据库里**已经**存在 alembic_version 表，什么都不做（由 `make db-upgrade` 管控）。
    2) 如果不存在 alembic_version，则：
       - 走 create_all 建表（兼容旧有开发流程，零配置可启动）
       - 再 stamp 到最新 alembic head，让后续增量变更走正式迁移
    设置环境变量 `API_SKIP_AUTO_MIGRATE=true` 可完全跳过，由运维显式执行 `alembic upgrade`。
    """
    if os.getenv("API_SKIP_AUTO_MIGRATE", "").lower() in {"1", "true", "yes"}:
        return

    from sqlalchemy import inspect

    from src.models.base import Base  # noqa: 延迟导入避免循环依赖

    inspector = inspect(engine)
    has_version = inspector.has_table("alembic_version")
    if has_version:
        return

    Base.metadata.create_all(bind=engine)

    # 标记为最新版，避免未来 alembic upgrade 重复建表
    try:
        from pathlib import Path

        from alembic import command
        from alembic.config import Config

        cfg_path = Path(__file__).resolve().parents[2] / "alembic.ini"
        if cfg_path.exists():
            cfg = Config(str(cfg_path))
            cfg.set_main_option("script_location", str(cfg_path.parent / "alembic"))
            cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
            command.stamp(cfg, "head")
    except Exception:   # noqa: BLE001 — alembic 可选，失败不影响启动
        pass
