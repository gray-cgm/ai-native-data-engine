"""dlkit —— Data Loop Kit.

零依赖（除 httpx）；面向算法工程师消费 AI Native Data Engine 出仓的数据。

最小用法：
    >>> import dlkit
    >>> dlkit.configure(base_url="http://platform.local:8000")
    >>> with dlkit.run(snapshot_traces=["trace_e2e_xxx"], consumer="me@team") as run:
    ...     for sample in dlkit.dataset("trace_e2e_xxx"):
    ...         # 训练你的 batch
    ...         run.report(sample_uid=sample["sample_uid"])

不上报也能用（`dlkit.fetch_snapshot(...)` 仅取 metadata）；上报失败仅 log，不
阻塞训练。MVP 阶段足够，后期再加 jsonl 落盘 / 重试。
"""

from .client import configure, fetch_snapshot, get_default_client
from .dataset import dataset, iter_samples
from .run import LossLogger, run, register_run, finish_run

__all__ = [
    "configure",
    "fetch_snapshot",
    "get_default_client",
    "dataset",
    "iter_samples",
    "run",
    "register_run",
    "finish_run",
    "LossLogger",
]
