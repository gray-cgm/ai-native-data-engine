"""TrainRun 注册 + 异步上报 buffer。

设计取舍（MVP，新人友好）：
- buffer 是普通 list + 后台 daemon thread 周期 flush
- 失败仅 log warning，事件丢弃；不本地落盘 / 不重试（P3 再补）
- 退出 with 块时 finish_run + 强制 flush 一次

外部 run_id：自动读 MLFLOW_RUN_ID / WANDB_RUN_ID 环境变量；用户显式传参优先。
"""

from __future__ import annotations

import logging
import os
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from .client import get_default_client


log = logging.getLogger("dlkit")

_FLUSH_INTERVAL_SEC = 2.0
_BATCH_SIZE = 500


def _detect_external_run_id() -> str | None:
    return (
        os.environ.get("MLFLOW_RUN_ID")
        or os.environ.get("WANDB_RUN_ID")
        or os.environ.get("KUBEFLOW_RUN_ID")
    )


class TrainRun:
    """与 server 端 train_runs 行对应；同时持有 sample 上报 buffer。"""

    def __init__(self, run_id: str, snapshot_traces: list[str]) -> None:
        self.run_id = run_id
        self.snapshot_traces = snapshot_traces
        self._buf: list[dict] = []
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"dlkit-flush-{run_id[:8]}")
        self._thread.start()

    def report(
        self,
        *,
        sample_uid: str,
        epoch: int | None = None,
        step: int | None = None,
        loss: float | None = None,
    ) -> None:
        """上报一条 sample 消费事件。线程安全；非阻塞。"""
        ev = {
            "snapshot_trace": self.snapshot_traces[0],  # 多 snapshot 时算工自取分辨
            "sample_uid": sample_uid,
            "train_run_id": self.run_id,
            "epoch": epoch,
            "step": step,
            "loss": loss,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            self._buf.append(ev)

    def flush(self) -> None:
        """同步 flush 当前 buffer。失败仅 log。"""
        with self._lock:
            batch, self._buf = self._buf, []
        if not batch:
            return
        try:
            get_default_client().post("/api/v1/exports/usage", json={"events": batch})
        except Exception as exc:  # noqa: BLE001 — best-effort
            log.warning("dlkit flush failed for %d events: %s", len(batch), exc)

    def _loop(self) -> None:
        while not self._stop.is_set():
            time.sleep(_FLUSH_INTERVAL_SEC)
            self.flush()

    def close(self) -> None:
        self._stop.set()
        self.flush()


def register_run(
    *,
    snapshot_traces: list[str],
    name: str | None = None,
    consumer: str | None = None,
    external_run_id: str | None = None,
    model_version: str | None = None,
    notes: str | None = None,
) -> TrainRun:
    """显式注册一条 TrainRun，返回可上报的 handle。"""
    payload = {
        "snapshot_ids": snapshot_traces,
        "name": name,
        "consumer": consumer or os.environ.get("USER"),
        "external_run_id": external_run_id or _detect_external_run_id(),
        "model_version": model_version,
        "notes": notes,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = get_default_client().post("/api/v1/exports/train-runs", json=payload)
    return TrainRun(run_id=resp["id"], snapshot_traces=snapshot_traces)


def finish_run(run: TrainRun, *, status: str = "completed") -> dict:
    run.close()
    return get_default_client().patch(
        f"/api/v1/exports/train-runs/{run.run_id}",
        json={"status": status},
    )


class LossLogger:
    """Per-sample loss 上报薄壳：包装 TrainRun.report，方便训练循环调用。

    用法（PyTorch / 任意框架，需自行算 per-sample loss，即 reduction='none'）：

        with dlkit.run(snapshot_traces=[...]) as run:
            logger = dlkit.LossLogger(run)
            for batch_idx, (x, y, sample_uids) in enumerate(loader):
                logits = model(x)
                losses = loss_fn(logits, y)        # shape: [batch], 没 reduce
                logger.log(sample_uids, losses.detach().cpu().tolist(),
                           epoch=epoch, step=batch_idx)
                losses.mean().backward(); opt.step()

    故意不做 framework callback hook —— 不同框架接口差异大，MVP 让算工自己控
    制何时调用更直白；后期再补 PyTorchLightning / HuggingFace 适配。
    """

    def __init__(self, run: "TrainRun") -> None:
        self.run = run

    def log(
        self,
        sample_uids: list[str] | str,
        losses: list[float] | float,
        *,
        epoch: int | None = None,
        step: int | None = None,
    ) -> None:
        if isinstance(sample_uids, str):
            sample_uids = [sample_uids]
        if isinstance(losses, (int, float)):
            losses = [float(losses)]
        if len(sample_uids) != len(losses):
            raise ValueError(
                f"sample_uids ({len(sample_uids)}) and losses ({len(losses)}) length mismatch"
            )
        for uid, loss in zip(sample_uids, losses):
            self.run.report(sample_uid=uid, loss=float(loss), epoch=epoch, step=step)


@contextmanager
def run(
    *,
    snapshot_traces: list[str],
    name: str | None = None,
    consumer: str | None = None,
    external_run_id: str | None = None,
    model_version: str | None = None,
) -> Iterator[TrainRun]:
    """上下文管理器：with dlkit.run(...) as r: r.report(...)"""
    handle = register_run(
        snapshot_traces=snapshot_traces,
        name=name,
        consumer=consumer,
        external_run_id=external_run_id,
        model_version=model_version,
    )
    try:
        yield handle
        finish_run(handle, status="completed")
    except Exception:
        finish_run(handle, status="failed")
        raise
