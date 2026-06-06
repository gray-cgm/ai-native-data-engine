"""core.database 的 get_db 生成器 + init_db 幂等短路。"""

from __future__ import annotations

from sqlalchemy.orm import Session

from src.core import database


def test_get_db_yields_and_closes():
    gen = database.get_db()
    db = next(gen)
    assert isinstance(db, Session)
    # 关闭：生成器 finally 触发 close
    closed = {"v": False}
    orig_close = db.close

    def _spy():
        closed["v"] = True
        orig_close()

    db.close = _spy
    gen.close()
    assert closed["v"] is True


def test_init_db_skips_when_env_set(monkeypatch):
    monkeypatch.setenv("API_SKIP_AUTO_MIGRATE", "true")
    # 直接返回，不碰任何引擎
    assert database.init_db() is None
