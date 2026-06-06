"""x_trace middleware 单元 + 请求级透传验证。"""

from __future__ import annotations

from src.api.middleware.x_trace import (
    TRACE_HEADER,
    _new_trace_id,
    get_trace_id,
)


def test_new_trace_id_prefix_and_uniqueness():
    a = _new_trace_id()
    b = _new_trace_id()
    assert a.startswith("trace_")
    assert len(a) == len("trace_") + 12
    assert a != b


def test_get_trace_id_reads_state():
    class _State:
        pass

    class _Req:
        state = _State()

    req = _Req()
    assert get_trace_id(req) is None
    req.state.x_trace_id = "trace_abc"
    assert get_trace_id(req) == "trace_abc"


def test_incoming_trace_is_propagated_to_response(client):
    r = client.get("/health", headers={TRACE_HEADER: "trace_upstream_001"})
    assert r.status_code == 200
    # 上游 trace 原样回写，不被中途新生成截断
    assert r.headers[TRACE_HEADER] == "trace_upstream_001"


def test_missing_trace_is_generated(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.headers[TRACE_HEADER].startswith("trace_")
