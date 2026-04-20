"""数据湖仓流水线 —— Dagster 软件定义资产 (SDA)

实现从原始采集包到最终发版数据集的全链路流转，对应 One-Pipeline 四阶段模型：
  Bronze(raw_ingest) → Silver(clip_extraction) → Silver(feature_extraction) → Gold(structured_dataset)

设计取舍：
- 使用 Dagster @asset 而非 @op/@job，拥抱"软件定义资产"理念
  * 每个 asset 声明"我产出什么数据"，而非"我执行什么步骤"
  * Dagster 自动推导依赖关系、增量更新和数据血缘
- DuckDB 作为 Silver 层的轻量级数据质量引擎：
  * 本地开发零依赖即可运行质量校验
  * 生产环境可平滑替换为 StarRocks/Trino
- 数据目录结构遵循现有工程约定：
  * data/bronze/ → 原始数据
  * data/silver/ → 清洗/特征数据
  * data/gold/   → 发版数据集
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import duckdb
from dagster import (
    AssetExecutionContext,
    AssetIn,
    Definitions,
    MetadataValue,
    asset,
)


# ─────────────────────────── 工具函数 ───────────────────────────


def _data_root() -> Path:
    """获取数据根目录，与现有工程约定一致"""
    return Path(os.getenv("DATA_DIR", "./data")).resolve()


def _timestamp_tag() -> str:
    """生成 ISO 时间戳标签，用于数据版本追踪"""
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


# ═══════════════════════════ Bronze 层：原始数据入库 ═══════════════════════════


@asset(
    group_name="data_pipeline",
    description="Bronze 层：将原始采集包（ROS bag / 传感器数据）注册到数据目录",
)
def raw_collection_ingest(context: AssetExecutionContext) -> dict[str, Any]:
    """原始采集包入库

    从指定目录扫描原始数据文件，注册到 Bronze 层目录。
    实际生产中这里会对接车端数据上传服务或 S3 同步。
    """
    bronze_dir = _data_root() / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)

    # 模拟扫描原始数据（实际场景对接 StorageAdapter）
    raw_files = list(bronze_dir.glob("**/*"))
    manifest = {
        "stage": "raw_ingest",
        "timestamp": _timestamp_tag(),
        "bronze_dir": str(bronze_dir),
        "file_count": len(raw_files),
        "files": [str(f.relative_to(bronze_dir)) for f in raw_files[:100]],
    }

    # 写入入库清单
    manifest_path = bronze_dir / "ingest_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

    context.add_output_metadata(
        {
            "file_count": MetadataValue.int(len(raw_files)),
            "bronze_dir": MetadataValue.path(str(bronze_dir)),
        }
    )
    context.log.info(f"Bronze 层入库完成：{len(raw_files)} 个文件")
    return manifest


# ═══════════════════════════ Silver 层：多模态切片 ═══════════════════════════


@asset(
    group_name="data_pipeline",
    ins={"raw_data": AssetIn(key="raw_collection_ingest")},
    description="Silver 层-切片：将原始数据按场景/时间窗口切割为 Clip/Episode",
)
def multimodal_clip_extraction(
    context: AssetExecutionContext, raw_data: dict[str, Any]
) -> dict[str, Any]:
    """多模态切片提取

    从 Bronze 层原始数据中，按场景和时间窗口切割出 Clip（片段），
    每个 Clip 包含多模态同步数据（Camera + LiDAR + CAN 等）。
    """
    silver_dir = _data_root() / "silver" / "clips"
    silver_dir.mkdir(parents=True, exist_ok=True)

    # 模拟切片逻辑（实际场景使用 One-Pipeline 的切片引擎）
    clip_count = max(raw_data.get("file_count", 0) // 10, 1)
    clips = []
    for i in range(clip_count):
        clip_id = f"clip_{_timestamp_tag()}_{i:04d}"
        clip_meta = {
            "clip_id": clip_id,
            "source_stage": "raw_ingest",
            "sensors": ["camera_front", "lidar_top", "can_bus"],
            "frame_count": 30,
            "duration_sec": 3.0,
        }
        clips.append(clip_meta)

    result = {
        "stage": "clip_extraction",
        "timestamp": _timestamp_tag(),
        "clip_count": len(clips),
        "output_dir": str(silver_dir),
        "clips": clips[:50],  # 限制输出大小
    }

    # 持久化切片元数据
    meta_path = silver_dir / "clips_manifest.json"
    meta_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))

    context.add_output_metadata(
        {
            "clip_count": MetadataValue.int(len(clips)),
            "output_dir": MetadataValue.path(str(silver_dir)),
        }
    )
    context.log.info(f"Silver 层切片完成：{len(clips)} 个 Clip")
    return result


# ═══════════════════════════ Silver 层：特征提取 + 质量校验 ═══════════════════════════


@asset(
    group_name="data_pipeline",
    ins={"clips": AssetIn(key="multimodal_clip_extraction")},
    description="Silver 层-特征：从切片中提取结构化特征，并用 DuckDB 做数据质量校验",
)
def feature_extraction_with_quality_check(
    context: AssetExecutionContext, clips: dict[str, Any]
) -> dict[str, Any]:
    """特征提取与数据质量校验

    1. 从切片中提取结构化特征（检测框、车道线、场景标签等）
    2. 使用 DuckDB 进行 Silver 层数据质量校验：
       - 拦截缺失关键特征的样本
       - 检查数值范围异常
       - 统计特征分布

    设计取舍：DuckDB 作为嵌入式分析引擎，零部署成本，
    且与现有 QueryAdapter(duckdb) 保持技术栈一致。
    """
    silver_dir = _data_root() / "silver" / "features"
    silver_dir.mkdir(parents=True, exist_ok=True)

    # ── 步骤 1：模拟特征提取 ──
    features = []
    for clip in clips.get("clips", []):
        feature = {
            "clip_id": clip["clip_id"],
            "scene_tag": "night_intersection",  # 模拟场景标签
            "has_pedestrian": True,
            "has_vehicle": True,
            "has_lane_marking": clip["clip_id"][-1] != "0",  # 模拟部分缺失
            "bbox_count": 12,
            "confidence_avg": 0.85,
            "lidar_points": 45000,
        }
        features.append(feature)

    # 写入 Parquet（此处简化为 JSON，实际使用 PyArrow 写 Parquet/Lance）
    features_path = silver_dir / "features.json"
    features_path.write_text(json.dumps(features, ensure_ascii=False, indent=2))

    # ── 步骤 2：DuckDB 数据质量校验 ──
    con = duckdb.connect(":memory:")

    # 将特征数据注册为 DuckDB 表
    con.execute(
        """
        CREATE TABLE features AS
        SELECT * FROM read_json_auto(?)
        """,
        [str(features_path)],
    )

    # 质量校验规则 1：拦截缺失关键特征（车道线标注）的样本
    missing_lane = con.execute(
        """
        SELECT clip_id
        FROM features
        WHERE has_lane_marking = false
        """
    ).fetchall()

    # 质量校验规则 2：检查置信度异常偏低的样本
    low_confidence = con.execute(
        """
        SELECT clip_id, confidence_avg
        FROM features
        WHERE confidence_avg < 0.5
        """
    ).fetchall()

    # 质量校验规则 3：统计特征分布
    distribution = con.execute(
        """
        SELECT
            COUNT(*) AS total_clips,
            SUM(CASE WHEN has_pedestrian THEN 1 ELSE 0 END) AS with_pedestrian,
            SUM(CASE WHEN has_vehicle THEN 1 ELSE 0 END) AS with_vehicle,
            SUM(CASE WHEN has_lane_marking THEN 1 ELSE 0 END) AS with_lane_marking,
            AVG(bbox_count) AS avg_bbox_count,
            AVG(confidence_avg) AS avg_confidence,
            AVG(lidar_points) AS avg_lidar_points
        FROM features
        """
    ).fetchone()

    con.close()

    quality_report = {
        "total_features": len(features),
        "quality_issues": {
            "missing_lane_marking": [r[0] for r in missing_lane],
            "low_confidence": [{"clip_id": r[0], "confidence": r[1]} for r in low_confidence],
        },
        "distribution": {
            "total_clips": distribution[0],
            "with_pedestrian": distribution[1],
            "with_vehicle": distribution[2],
            "with_lane_marking": distribution[3],
            "avg_bbox_count": round(distribution[4], 2) if distribution[4] else 0,
            "avg_confidence": round(distribution[5], 3) if distribution[5] else 0,
            "avg_lidar_points": round(distribution[6], 0) if distribution[6] else 0,
        },
        "passed": len(missing_lane) == 0 and len(low_confidence) == 0,
    }

    # 持久化质量报告
    report_path = silver_dir / "quality_report.json"
    report_path.write_text(json.dumps(quality_report, ensure_ascii=False, indent=2))

    result = {
        "stage": "feature_extraction",
        "timestamp": _timestamp_tag(),
        "feature_count": len(features),
        "output_dir": str(silver_dir),
        "quality_report": quality_report,
    }

    issues_count = len(missing_lane) + len(low_confidence)
    context.add_output_metadata(
        {
            "feature_count": MetadataValue.int(len(features)),
            "quality_passed": MetadataValue.bool(quality_report["passed"]),
            "quality_issues_count": MetadataValue.int(issues_count),
        }
    )

    if not quality_report["passed"]:
        context.log.warning(
            f"数据质量校验未通过：{issues_count} 个问题"
            f"（缺失车道线: {len(missing_lane)}，低置信度: {len(low_confidence)}）"
        )
    else:
        context.log.info("数据质量校验全部通过")

    return result


# ═══════════════════════════ Gold 层：发版数据集 ═══════════════════════════


@asset(
    group_name="data_pipeline",
    ins={"features": AssetIn(key="feature_extraction_with_quality_check")},
    description="Gold 层：生成最终发版数据集，仅包含通过质量校验的样本",
)
def structured_dataset_release(
    context: AssetExecutionContext, features: dict[str, Any]
) -> dict[str, Any]:
    """最终发版数据集

    从 Silver 层的特征数据中：
    1. 过滤掉未通过质量校验的样本
    2. 组装结构化数据集（对应 Image → Group → Line → Point → Properties）
    3. 生成数据集版本清单

    即使质量校验有问题，仍然产出数据集（标记质量状态），
    让下游消费者自行决定是否使用，避免流水线完全阻塞。
    """
    gold_dir = _data_root() / "gold" / "datasets"
    gold_dir.mkdir(parents=True, exist_ok=True)

    quality_report = features.get("quality_report", {})
    quality_issues = quality_report.get("quality_issues", {})
    blocked_clips = set(quality_issues.get("missing_lane_marking", []))

    # 过滤出通过校验的特征
    features_path = _data_root() / "silver" / "features" / "features.json"
    all_features = json.loads(features_path.read_text()) if features_path.exists() else []
    passed_features = [f for f in all_features if f["clip_id"] not in blocked_clips]

    version_tag = _timestamp_tag()
    dataset = {
        "dataset_id": f"ds_{version_tag}",
        "version": version_tag,
        "stage": "structured_dataset",
        "total_samples": len(all_features),
        "passed_samples": len(passed_features),
        "blocked_samples": len(blocked_clips),
        "quality_passed": quality_report.get("passed", False),
        "schema": {
            "description": "结构化标注数据集，对应 Image → Group → Line → Point → Properties",
            "columns": [
                "clip_id",
                "scene_tag",
                "has_pedestrian",
                "has_vehicle",
                "has_lane_marking",
                "bbox_count",
                "confidence_avg",
                "lidar_points",
            ],
        },
        "samples": passed_features,
    }

    # 持久化发版数据集
    dataset_path = gold_dir / f"dataset_{version_tag}.json"
    dataset_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2))

    # 更新最新版本指针
    latest_path = gold_dir / "latest.json"
    latest_path.write_text(
        json.dumps(
            {"latest_version": version_tag, "path": str(dataset_path)},
            ensure_ascii=False,
            indent=2,
        )
    )

    context.add_output_metadata(
        {
            "dataset_id": MetadataValue.text(dataset["dataset_id"]),
            "total_samples": MetadataValue.int(dataset["total_samples"]),
            "passed_samples": MetadataValue.int(dataset["passed_samples"]),
            "blocked_samples": MetadataValue.int(dataset["blocked_samples"]),
            "output_path": MetadataValue.path(str(dataset_path)),
        }
    )
    context.log.info(
        f"Gold 层发版完成：{dataset['passed_samples']}/{dataset['total_samples']} 样本通过"
    )
    return dataset
