"""dataset() —— 给定 snapshot_trace，迭代 sample 列表。

故意不依赖 PyTorch / TF；返回一个普通可迭代 dict 序列，算工自己 wrap 成
DataLoader。MVP 阶段先把"消费哪些 sample"这件事跑通；torch 集成放 P2。

每个 yield 出来的 dict 至少含 sample_uid（dataset_id:clip_id:ts），用户可以
直接传给 TrainRun.report(sample_uid=...)。
"""

from __future__ import annotations

from typing import Any, Iterator

from .client import fetch_snapshot, get_default_client


def _sample_uid(dataset_id: str, clip_id: str, ts: Any) -> str:
    return f"{dataset_id}:{clip_id}:{ts}"


def iter_samples(snapshot_trace: str) -> Iterator[dict]:
    """从 snapshot 反查 dataset_id，再列其 samples。"""
    snap = fetch_snapshot(snapshot_trace)
    dataset_id = snap.get("dataset_id")
    if not dataset_id:
        return
    client = get_default_client()
    # 平台 datasets 路由分页能力较强；MVP 取一页 1000 条，超出再分页。
    resp = client.get(f"/api/v1/datasets/{dataset_id}/samples", params={"limit": 1000})
    for s in resp.get("items", []):
        yield {
            "sample_uid": _sample_uid(dataset_id, s["clip_id"], s["ts"]),
            "snapshot_trace": snapshot_trace,
            "dataset_id": dataset_id,
            **s,
        }


def dataset(snapshot_trace: str) -> list[dict]:
    """返回 sample 列表。物化在内存——MVP 量级（< 100k 条）足够。

    > 注：要适配 PyTorch DataLoader 直接 `list(dlkit.dataset(...))` 即可。
    > 真要无限流式读取，用 iter_samples()。
    """
    return list(iter_samples(snapshot_trace))
