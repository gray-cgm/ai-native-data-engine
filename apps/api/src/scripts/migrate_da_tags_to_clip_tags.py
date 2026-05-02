"""把历史 ``da_tags``（CSV 字符串数组）迁移到 clip_tags 关系表。

使用：
    python -m src.scripts.migrate_da_tags_to_clip_tags

策略：
- 数据源：Lance 端 ClipMeta.da_tags + LineageEvent.payload 中带 da_tags 的 EventResult
- 目标：每个 da_tag 写一行 ClipTag(source=manual, source_version="legacy:da")
- 幂等：(clip_id, name, source, source_version) 联合唯一，重复跑跳过
- 不删除 da_tags 字段；后续 schema 切除由独立 PR 处理

设计文档：docs/architecture/tags-design.md。
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from src.core.database import SessionLocal, init_db
from src.models.clip_tag import ClipTag, TagSource
from src.models.lineage_event import EventResult


def _parse_csv_tags(value: str | None) -> list[str]:
    if not value:
        return []
    return [p.strip() for p in str(value).split(",") if p.strip()]


def migrate_from_event_results(db, dry_run: bool = False) -> int:
    """扫描 EventResult.da_tags，对每条非空 da_tags 字符串拆出 N 个 ClipTag。"""
    rows = db.query(EventResult).filter(EventResult.da_tags.isnot(None)).all()
    inserted = 0
    for r in rows:
        clip_id = (r.clip_ids or [None])[0]
        if not clip_id:
            continue
        for tag_name in _parse_csv_tags(r.da_tags):
            tag = ClipTag(
                clip_id=clip_id,
                name=tag_name,
                source=TagSource.MANUAL.value,
                source_version="legacy:da",
                confidence=None,
                applied_at=getattr(r, "applied_at", None) or datetime.now(timezone.utc),
                notes=f"migrated from EventResult.da_tags (event_pk={r.event_pk})",
                x_trace_id=getattr(r, "x_trace_id", None),
            )
            try:
                db.add(tag)
                db.flush()
                inserted += 1
            except IntegrityError:
                db.rollback()  # 已存在，跳过
    if not dry_run:
        db.commit()
    else:
        db.rollback()
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate da_tags → clip_tags")
    parser.add_argument("--dry-run", action="store_true", help="试跑不写库")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        inserted = migrate_from_event_results(db, dry_run=args.dry_run)
        action = "would insert" if args.dry_run else "inserted"
        print(f"✔ {action} {inserted} clip_tags rows")
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
