"""X-Trace-Id middleware

把 ADR `adr-pipelinerun-unified-fact-model.md` 里约定的 `X-Trace-Id` HTTP 头
落进 request.state，供下游路由直接读取（而不需要每个 handler 自己 parse）。
若请求没带，自动生成一个 `trace_<uuid12>`，并在响应头回写，便于客户端串联。

只读 middleware：不动 body、不动 status；不会破坏现有契约。
"""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


TRACE_HEADER = "X-Trace-Id"
TRACE_STATE_KEY = "x_trace_id"


def _new_trace_id() -> str:
    return f"trace_{uuid.uuid4().hex[:12]}"


def get_trace_id(request: Request) -> str | None:
    """让路由通过 `from .middleware.x_trace import get_trace_id` 读 trace。"""
    return getattr(request.state, TRACE_STATE_KEY, None)


class XTraceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        trace = request.headers.get(TRACE_HEADER) or _new_trace_id()
        setattr(request.state, TRACE_STATE_KEY, trace)
        response = await call_next(request)
        response.headers[TRACE_HEADER] = trace
        return response
