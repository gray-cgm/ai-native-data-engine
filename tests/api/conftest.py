"""apps/api 测试基建：临时 sqlite + TestClient + get_db 覆盖。

- 每个用例一个独立内存 sqlite（StaticPool 保证同连接），建全表。
- 覆盖 FastAPI 的 ``get_db`` 依赖指向测试 session。
- 不触发 app startup（``TestClient(app)`` 非 context manager 不跑 on_event），
  因此 ``init_db()`` / 真 DB 文件不会被碰。
- 运行时容器走真实 local-dev profile（catalog/operations 路由读 demo 元数据），
  这是只读 metadata adapter，零外部依赖。
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("API_SKIP_AUTO_MIGRATE", "true")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# 触发全部 ORM 注册到 Base.metadata
import src.models  # noqa: F401
from src.models.base import Base


@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    TestingSessionLocal = sessionmaker(
        bind=db_engine, autoflush=False, autocommit=False
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_engine):
    """TestClient，DB 指向临时 sqlite。每个请求一个 session。"""
    from fastapi.testclient import TestClient

    from src.core.database import get_db
    from src.main import app

    TestingSessionLocal = sessionmaker(
        bind=db_engine, autoflush=False, autocommit=False
    )

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── 业务种子辅助 ──────────────────────────────────────────────────────


@pytest.fixture
def seed(db_session):
    """返回一个工厂集合，按需在测试 session 里造数据。"""
    from datetime import datetime, timezone

    from src.models.base import (
        OperationsModule,
        Priority,
        RequirementSource,
        TaskType,
    )
    from src.models.requirement import (
        DataTask,
        OperationsTask,
        PipelineRun,
        Requirement,
    )

    created: dict = {}

    def requirement(**kw):
        r = Requirement(
            title=kw.get("title", "需求-夜间路口"),
            source=kw.get("source", RequirementSource.DRE),
            priority=kw.get("priority", Priority.HIGH),
            dre_owner=kw.get("dre_owner", "alice@x.com"),
            **{k: v for k, v in kw.items() if k not in {"title", "source", "priority", "dre_owner"}},
        )
        db_session.add(r)
        db_session.commit()
        db_session.refresh(r)
        return r

    def data_task(requirement_id, **kw):
        t = DataTask(
            requirement_id=requirement_id,
            title=kw.get("title", "采集任务"),
            task_type=kw.get("task_type", TaskType.COLLECTION),
            x_trace_id=kw.get("x_trace_id"),
        )
        db_session.add(t)
        db_session.commit()
        db_session.refresh(t)
        return t

    def operations_task(requirement_id, data_task_id, **kw):
        o = OperationsTask(
            requirement_id=requirement_id,
            data_task_id=data_task_id,
            module=kw.get("module", OperationsModule.LABELING),
            title=kw.get("title", "运维任务"),
            x_trace_id=kw.get("x_trace_id"),
        )
        db_session.add(o)
        db_session.commit()
        db_session.refresh(o)
        return o

    def pipeline_run(data_task_id, **kw):
        run = PipelineRun(
            data_task_id=data_task_id,
            pipeline_name=kw.get("pipeline_name", "p-clip"),
            stage=kw.get("stage", "collect"),
            input_uri=kw.get("input_uri", "s3://in"),
            x_trace_id=kw.get("x_trace_id"),
            requirement_id=kw.get("requirement_id"),
            operations_task_id=kw.get("operations_task_id"),
            metrics=kw.get("metrics"),
            output_uri=kw.get("output_uri"),
        )
        db_session.add(run)
        db_session.commit()
        db_session.refresh(run)
        return run

    created.update(
        requirement=requirement,
        data_task=data_task,
        operations_task=operations_task,
        pipeline_run=pipeline_run,
        now=lambda: datetime.now(timezone.utc),
    )
    return created
