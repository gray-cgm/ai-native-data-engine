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
    """启动时创建所有表（幂等操作）"""
    from src.models.base import Base  # noqa: 延迟导入避免循环依赖

    Base.metadata.create_all(bind=engine)
