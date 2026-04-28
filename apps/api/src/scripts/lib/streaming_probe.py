"""探测 Kafka broker 是否可用，返回应使用的 streaming target。

软依赖语义：默认尝试 Kafka，broker 不可达则降级到 file-mode（写 JSONL），让
``make e2e-demo`` 在没起 ``make up-deps`` 的开发环境也能完整跑完。

返回值：``("kafka", bootstrap)`` 或 ``("file", reason)``。
"""

from __future__ import annotations

import os
import socket


def probe(timeout: float = 1.0) -> tuple[str, str]:
    bootstrap = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    host, _, port = bootstrap.partition(":")
    try:
        port_i = int(port or "9092")
    except ValueError:
        return "file", f"invalid port in KAFKA_BOOTSTRAP_SERVERS={bootstrap}"

    try:
        with socket.create_connection((host, port_i), timeout=timeout):
            return "kafka", bootstrap
    except OSError as exc:
        return "file", f"broker {bootstrap} unreachable: {exc}"
