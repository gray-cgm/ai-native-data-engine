"""Labeling 标注保存闭环 —— 把前端 cornerstone3D 标注落成 EventResult。

设计取舍：
- 标注是 labeling 维度的"事实产物"，按 Snowflake 模型走 LineageEvent(event_type=
  "labeling") + EventResult(payload_type="label")，不新建物理表。
- 一次保存 = 一条 event + N 条 result（N = 标注对象数）。event 是 append-only 事实，
  所以"重新保存"产生新 event；加载时取该 clip 最近一条 labeling event 的 results。
- 几何/工具/uid 这些 cornerstone 专有结构塞 EventResult.extra（JSON）；人工标签文本
  落 da_tags（与既有人工标注 tag 语义一致）。
- x_trace_id 全程透传，不在此处新生成，避免断链。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from src.models.base import OperationsModule
from src.models.lineage_event import EventResult, LineageEvent
from src.models.ops_item import OpsItem
from src.services import event_service

# labeling 完成态（对齐 ops_modules.py 的 _STATUS_BY_MODULE["labeling"]）
LABELING_DONE_STATUS = "done"


@dataclass
class AnnotationInput:
    """前端单个 cornerstone 标注对象的落库表示。"""

    uid: str
    tool: str
    label: Optional[str] = None
    data: Optional[dict] = None  # cornerstone annotation.data（几何）
    ts: Optional[int] = None


def save_annotations(
    db: Session,
    *,
    clip_id: str,
    annotations: list[AnnotationInput],
    ops_item_id: Optional[str] = None,
    operations_task_id: Optional[str] = None,
    requirement_id: Optional[str] = None,
    x_trace_id: Optional[str] = None,
    image_id: Optional[str] = None,
    pipeline_commit: Optional[str] = None,
) -> tuple[LineageEvent, Optional[OpsItem]]:
    """把一组标注写成 1 条 labeling event + N 条 label result，并把对应 labeling
    OpsItem 推进到 done（单事务）。

    若给了 ops_item_id，则上游（operations_task_id / requirement_id / x_trace_id）
    一律从 OpsItem 派生 —— OpsItem 是 labeling 工作项的权威上游，避免用可能过期/
    缺失的 URL 参数截断 trace 链。
    """
    item: Optional[OpsItem] = None
    if ops_item_id:
        item = (
            db.query(OpsItem)
            .filter(
                OpsItem.id == ops_item_id,
                OpsItem.module == OperationsModule.LABELING,
                OpsItem.deleted_at.is_(None),
            )
            .first()
        )
        if item is None:
            raise ValueError(f"labeling ops_item not found: {ops_item_id}")

    eff_trace = (item.x_trace_id if item and item.x_trace_id else x_trace_id)
    eff_req = item.requirement_id if item else requirement_id
    eff_ops_task = item.operations_task_id if item else operations_task_id

    results = [
        event_service.EventResultPayload(
            clip_id=clip_id,
            payload_type="label",
            da_tags=a.label,
            ts=a.ts,
            extra={
                "uid": a.uid,
                "tool": a.tool,
                "image_id": image_id,
                "data": a.data,
            },
            note=a.tool,
        )
        for a in annotations
    ]
    ev = event_service.emit_event(
        db,
        event_type="labeling",
        source_type="manual_ui",
        operations_task_id=eff_ops_task,
        requirement_id=eff_req,
        x_trace_id=eff_trace,
        pipeline_commit=pipeline_commit,
        payload={
            "image_id": image_id,
            "annotation_count": len(results),
            "ops_item_id": ops_item_id,
        },
        results=results,
    )

    # 闭环：把 labeling 工作项推到 done，并在 payload 里回挂产出的 event 收据。
    if item is not None:
        item.status = LABELING_DONE_STATUS
        payload = dict(item.payload or {})
        payload["last_labeling_event_id"] = ev.event_id
        payload["last_labeling_event_pk"] = ev.id
        item.payload = payload
        db.flush()

    return ev, item


def load_latest(
    db: Session,
    *,
    clip_id: str,
    x_trace_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """取某 clip 最近一条 labeling event 及其 results；没有则 None。"""
    q = (
        db.query(LineageEvent)
        .join(EventResult, EventResult.event_pk == LineageEvent.id)
        .filter(LineageEvent.event_type == "labeling")
        .filter(EventResult.clip_id == clip_id)
    )
    if x_trace_id:
        q = q.filter(LineageEvent.x_trace_id == x_trace_id)
    ev = q.order_by(desc(LineageEvent.created_at)).first()
    if not ev:
        return None
    return event_service.serialize_event(ev, with_results=True)
