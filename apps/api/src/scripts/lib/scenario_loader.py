"""加载 / 选取 e2e demo scenario YAML。

每个场景一个 YAML，schema 见 scenarios/night_vru.yaml。
- ``load(name)``：按名加载
- ``random_choice(rng)``：随机选一个（SCENARIO=random 时调用）
- ``available()``：列出全部场景名
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


SCENARIO_DIR = Path(__file__).resolve().parent.parent / "scenarios"


@dataclass
class Scenario:
    name: str
    title: str
    description: str
    scene_tags: list[str]
    vehicle_tags: list[str]
    priority: str
    source: str
    estimated_data_volume: int
    clip_filter: dict[str, Any]
    stage_sequence: list[str]
    cost_template: dict[str, Any]
    quality_gate: dict[str, Any]
    # 业务级 DataTask 拆解（项目经理视角的里程碑），4 条工单覆盖
    # collection / annotation / quality_check / pipeline 四个类型。
    data_tasks: list[dict[str, Any]] = field(default_factory=list)
    streaming_topic: str = "streaming.events.raw"
    raw: dict[str, Any] = field(default_factory=dict)


def _path_for(name: str) -> Path:
    safe = name.replace("-", "_")
    p = SCENARIO_DIR / f"{safe}.yaml"
    if not p.exists():
        raise FileNotFoundError(f"scenario yaml not found: {p}")
    return p


def available() -> list[str]:
    return sorted(p.stem.replace("_", "-") for p in SCENARIO_DIR.glob("*.yaml"))


def load(name: str) -> Scenario:
    raw = yaml.safe_load(_path_for(name).read_text(encoding="utf-8"))
    return Scenario(
        name=raw["name"],
        title=raw["title"],
        description=raw.get("description", ""),
        scene_tags=list(raw.get("scene_tags", [])),
        vehicle_tags=list(raw.get("vehicle_tags", [])),
        priority=raw.get("priority", "medium"),
        source=raw.get("source", "dre"),
        estimated_data_volume=int(raw.get("estimated_data_volume", 1000)),
        clip_filter=dict(raw.get("clip_filter", {})),
        stage_sequence=list(raw.get("stage_sequence", [])),
        cost_template=dict(raw.get("cost_template", {})),
        quality_gate=dict(raw.get("quality_gate", {})),
        data_tasks=list(raw.get("data_tasks", [])),
        streaming_topic=str(raw.get("streaming_topic", "streaming.events.raw")),
        raw=raw,
    )


def random_choice(rng: random.Random) -> Scenario:
    names = available()
    if not names:
        raise FileNotFoundError(f"no scenario yaml under {SCENARIO_DIR}")
    return load(rng.choice(names))


def resolve(scenario_arg: str | None, rng: random.Random) -> Scenario:
    """SCENARIO 环境变量解析：None/random/具体名 → Scenario 实例。"""
    if not scenario_arg or scenario_arg.lower() == "random":
        return random_choice(rng)
    return load(scenario_arg.lower())
