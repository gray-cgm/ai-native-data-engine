"""按 scenario 配置筛选 ``data/lance/`` 下的 clip 候选集。

scenario.clip_filter:
  scenarios: 列表（match meta.scenario）
  any_tags: 列表（命中任意 meta.tags 或 meta.da_tags）
  fallback_take: 没匹配时退化取前 N 条（避免 demo 直接断）

不依赖 catalog 索引，直接走 ``adapters.clip_reader`` 扫盘 — 重启友好、零状态。
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path

from adapters import clip_reader


DEFAULT_LANCE_ROOT = Path("data/lance")


@dataclass
class ClipCandidate:
    clip_id: str
    scenario: str | None
    vehicle_name: str | None
    city: str | None
    district: str | None
    tags: list[str]
    da_tags: list[str]
    keyframe_count: int
    path: str


def _normalize_tags(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    return [t.strip() for t in str(value).split(",") if t.strip()]


def list_candidates(
    lance_root: Path = DEFAULT_LANCE_ROOT,
    *,
    scenarios: list[str] | None = None,
    any_tags: list[str] | None = None,
    fallback_take: int = 0,
    rng: random.Random | None = None,
) -> list[ClipCandidate]:
    rng = rng or random.Random()
    if not lance_root.exists():
        return []

    raw_clips = clip_reader.list_clips(lance_root)
    matches: list[ClipCandidate] = []
    fallback: list[ClipCandidate] = []

    sc_set = {s.lower() for s in (scenarios or [])}
    tag_set = {t.lower() for t in (any_tags or [])}

    for c in raw_clips:
        tags = _normalize_tags(getattr(c, "tags", None))
        da = _normalize_tags(getattr(c, "da_tags", None))
        cand = ClipCandidate(
            clip_id=c.clip_id,
            scenario=c.scenario,
            vehicle_name=c.vehicle_name,
            city=c.city,
            district=c.district,
            tags=tags,
            da_tags=da,
            keyframe_count=getattr(c, "keyframe_count", 0),
            path=str(c.path),
        )
        scen_hit = bool(sc_set) and (c.scenario or "").lower() in sc_set
        tag_hit = bool(tag_set) and bool(
            tag_set & {t.lower() for t in (tags + da)}
        )
        if scen_hit or tag_hit:
            matches.append(cand)
        else:
            fallback.append(cand)

    if matches:
        return matches
    # 退化：随机取 fallback_take（默认 1）
    take = max(1, int(fallback_take or 1))
    rng.shuffle(fallback)
    return fallback[:take]
