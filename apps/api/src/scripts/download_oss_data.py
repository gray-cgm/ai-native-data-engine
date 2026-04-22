"""
从阿里云 OSS 批量下载 foundation_model_base 数据集脚本

使用方式:
    python download_oss_data.py                   # 下载 clip 数据 + 缩略视频
    python download_oss_data.py --thumbnails-only # 仅下载缩略视频（假设 meta.lance 已在本地）

配置说明:
    修改下方 CONFIG 区域中的 OSS 连接信息、本地存储路径和需要下载的 id_list。

缩略视频规则:
    优先读取 ``meta.lance.mp4_resize_path[sensor]`` 列表的首个条目（列表顺序 =
    质量阶梯，首个即为最小分辨率缩略）。若该字段为空则回退到
    ``meta.lance.mp4_path[sensor]``。缩略文件落盘到
    ``data/raw/thumbnail_video/<clip_id>/<sensor>.mp4``。
"""

import argparse
import os
import re
import sys
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import oss2

# ============================================================
# 配置区域 - 根据实际情况修改
# ============================================================

# 阿里云 OSS 连接信息
OSS_CONFIG = {
    "access_key_id": os.environ.get("OSS_ACCESS_KEY_ID", "your_access_key_id"),
    "access_key_secret": os.environ.get("OSS_ACCESS_KEY_SECRET", "your_access_key_secret"),
    "endpoint": os.environ.get("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com"),
}

# 异步多线程下载并发度
MAX_WORKERS = int(os.environ.get("OSS_MAX_WORKERS", "8"))

# 本地数据存放根目录
LOCAL_BASE_DIR = Path(os.environ.get("OSS_LOCAL_DIR", "data/lance"))
THUMBNAIL_BASE_DIR = Path(os.environ.get("OSS_THUMBNAIL_DIR", "data/raw/thumbnail_video"))

# OSS Bucket 和路径模板
OSS_BUCKET = "dl-data-storage"
OSS_PATH_TEMPLATE = "foundation_model_base/{id}"
ID_LIST_FILE_PATH = Path(__file__).with_name("tobe_download_list.json")
# 需要下载的 ID 列表
Clip_LIST: list[dict] = []
if ID_LIST_FILE_PATH.exists():
    import json

    with ID_LIST_FILE_PATH.open("r") as f:
        Clip_LIST = json.load(f)

ID_LIST = [item["clip_id"] for item in Clip_LIST]
ID_LIST = list(dict.fromkeys(ID_LIST))

# ============================================================
# 以下为脚本逻辑，无需修改
# ============================================================


def validate_config() -> None:
    """校验 OSS 配置是否完整。"""
    required_keys = ("access_key_id", "access_key_secret", "endpoint")
    missing = [k for k in required_keys if not OSS_CONFIG.get(k)]
    placeholders = {
        "your_access_key_id",
        "your_access_key_secret",
    }
    if any(OSS_CONFIG.get(k) in placeholders for k in required_keys):
        missing.append("placeholder values")

    if missing:
        print("[ERROR] OSS 配置不完整，请检查以下字段:")
        for key in sorted(set(missing)):
            print(f"  - {key}")
        print(
            "[HINT] 推荐通过环境变量配置: OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
        )
        sys.exit(1)


def create_bucket(bucket_name: str, endpoint: str | None = None) -> oss2.Bucket:
    """初始化任意 OSS Bucket 客户端。"""
    endpoint_to_use = endpoint or OSS_CONFIG["endpoint"]
    auth = oss2.Auth(OSS_CONFIG["access_key_id"], OSS_CONFIG["access_key_secret"])
    return oss2.Bucket(auth, endpoint_to_use, bucket_name)


def extract_recommended_endpoint(exc: oss2.exceptions.OssError) -> str | None:
    """从 OSS 错误中提取服务端推荐的 endpoint。"""
    details: dict[str, Any] = {}
    if isinstance(getattr(exc, "details", None), dict):
        details = exc.details

    endpoint = details.get("Endpoint")
    if isinstance(endpoint, str) and endpoint.strip():
        return endpoint.strip()
    return None


def build_prefix(id_: str) -> str:
    """构造对象前缀，用于递归遍历目录。"""
    return OSS_PATH_TEMPLATE.format(id=id_).rstrip("/") + "/"


def format_size(num_bytes: int) -> str:
    """把字节数转成可读文本。"""
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if value < 1024.0 or unit == "TB":
            return f"{value:.1f}{unit}"
        value /= 1024.0
    return f"{num_bytes}B"


def iter_objects(bucket: oss2.Bucket, prefix: str):
    """递归遍历前缀下的所有对象，返回 (key, size)。"""
    for obj in oss2.ObjectIteratorV2(bucket, prefix=prefix):
        key = obj.key
        if key.endswith("/"):
            continue
        yield key, obj.size


def download_one_file(bucket_name: str, key: str, target: Path, endpoint: str | None = None) -> None:
    """在线程池中下载单文件。"""
    bucket = create_bucket(bucket_name, endpoint)
    bucket.get_object_to_file(key, str(target))


def run_download_job(job: tuple[str, str, str, Path, int, str | None]) -> tuple[bool, str, int, str]:
    """执行单个下载任务并返回结果。"""
    bucket_name, key, relative, target, size, endpoint = job
    try:
        download_one_file(bucket_name, key, target, endpoint)
        return True, relative, size, ""
    except Exception as exc:
        return False, relative, size, str(exc)


async def download_one(id_: str, endpoint_override: str | None = None, retried: bool = False) -> bool:
    """
    使用 asyncio + ThreadPoolExecutor 并发下载单个 id 目录。
    返回 True 表示成功，False 表示失败。
    """
    prefix = build_prefix(id_)
    local_dir = LOCAL_BASE_DIR / id_
    local_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[INFO] 开始下载: oss://{OSS_BUCKET}/{prefix}")
    print(f"[INFO] 本地目标: {local_dir.resolve()}")
    active_endpoint = endpoint_override or OSS_CONFIG["endpoint"]
    print(f"[INFO] Endpoint: {active_endpoint}")
    print(f"[INFO] 并发线程数: {MAX_WORKERS}")
    print("-" * 60)

    try:
        list_bucket = create_bucket(OSS_BUCKET, active_endpoint)
        objects = list(iter_objects(list_bucket, prefix))
        if not objects:
            print(f"[WARN] 前缀下无文件: oss://{OSS_BUCKET}/{prefix}")
            return False

        jobs: list[tuple[str, str, str, Path, int, str | None]] = []
        for key, size in objects:
            relative = key[len(prefix):]
            if not relative:
                continue
            target = local_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            jobs.append((OSS_BUCKET, key, relative, target, size, active_endpoint))

        total_files = len(jobs)
        if total_files == 0:
            print(f"[WARN] 前缀下无可下载文件: oss://{OSS_BUCKET}/{prefix}")
            return False

        print(f"[INFO] 待下载文件数: {total_files}")

        loop = asyncio.get_running_loop()
        ok_count = 0
        fail_count = 0
        downloaded_bytes = 0

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = [
                loop.run_in_executor(executor, run_download_job, job)
                for job in jobs
            ]

            for idx, completed in enumerate(asyncio.as_completed(futures), start=1):
                ok, relative, size, err = await completed
                if ok:
                    ok_count += 1
                    downloaded_bytes += max(size, 0)
                else:
                    fail_count += 1
                    print(f"[FILE-FAIL] {relative} | {err}")

                pct = idx / total_files * 100
                print(
                    f"[PROGRESS] {idx}/{total_files} ({pct:5.1f}%) "
                    f"success={ok_count} fail={fail_count} downloaded={format_size(downloaded_bytes)}"
                )

        if fail_count > 0:
            print(f"[FAIL] 下载完成但存在失败文件: {id_} (失败 {fail_count}/{total_files})")
            return False

        print(f"[OK]   下载完成: {id_} (文件 {ok_count}/{total_files})")
        return True
    except oss2.exceptions.OssError as exc:
        suggested_endpoint = extract_recommended_endpoint(exc)
        if (
            not retried
            and suggested_endpoint
            and suggested_endpoint != active_endpoint
        ):
            print(
                f"[WARN] 当前 endpoint={active_endpoint} 不匹配，自动重试 endpoint={suggested_endpoint}"
            )
            return await download_one(id_, endpoint_override=suggested_endpoint, retried=True)

        print(f"[FAIL] 下载失败: {id_} (OSS 错误: {exc})")
        if suggested_endpoint and suggested_endpoint != active_endpoint:
            print(
                f"[HINT] 请将 OSS_ENDPOINT 设置为: {suggested_endpoint}"
            )
        return False


# ============================================================
# 缩略视频下载：解析 meta.lance.mp4_resize_path / mp4_path 并下载
# ============================================================


_OSS_URI_RE = re.compile(r"^oss://(?P<bucket>[^/]+)/(?P<key>.+)$")


def _parse_oss_uri(uri: str) -> tuple[str, str] | None:
    if not isinstance(uri, str):
        return None
    m = _OSS_URI_RE.match(uri.strip())
    if m:
        return m.group("bucket"), m.group("key")
    # Accept https URLs as well (oss-cn-xxx.aliyuncs.com/key or bucket.oss-cn.../key)
    parsed = urlparse(uri)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        host = parsed.netloc
        path = parsed.path.lstrip("/")
        if "." in host and host.split(".", 1)[1].startswith("oss-"):
            bucket = host.split(".", 1)[0]
            return bucket, path
        # endpoint-style: host is the endpoint, first path segment is bucket
        parts = path.split("/", 1)
        if len(parts) == 2:
            return parts[0], parts[1]
    return None


def _read_meta_mp4_maps(clip_dir: Path) -> tuple[dict[str, list[str]], dict[str, str]] | None:
    """Return ``(resize_map, mp4_path_map)`` parsed from the clip's meta.lance."""

    import lance

    meta_path = clip_dir / "meta.lance"
    if not meta_path.exists():
        return None
    table = lance.dataset(str(meta_path)).to_table()
    if table.num_rows == 0:
        return None

    def _to_dict(value: Any) -> dict:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if isinstance(value, list):
            return {k: v for k, v in value if isinstance(k, str)}
        return {}

    resize_raw = _to_dict(
        table.column("mp4_resize_path")[0].as_py() if "mp4_resize_path" in table.column_names else None
    )
    mp4_raw = _to_dict(
        table.column("mp4_path")[0].as_py() if "mp4_path" in table.column_names else None
    )
    resize: dict[str, list[str]] = {}
    for sensor, variants in resize_raw.items():
        if not variants:
            continue
        if isinstance(variants, str):
            resize[sensor] = [variants]
        elif isinstance(variants, list):
            resize[sensor] = [v for v in variants if isinstance(v, str)]
    mp4_path = {k: v for k, v in mp4_raw.items() if isinstance(v, str)}
    return resize, mp4_path


def _pick_sensor_uri(sensor: str, resize: dict[str, list[str]], mp4_path: dict[str, str]) -> str | None:
    """按需求挑选每个 sensor 的下载 URI：优先 resize 列表首个，回退 mp4_path。"""

    if sensor in resize and resize[sensor]:
        return resize[sensor][0]
    return mp4_path.get(sensor)


async def download_thumbnails_for_clip(
    clip_id: str, endpoint_override: str | None = None
) -> bool:
    """Download a representative MP4 per sensor into ``data/raw/thumbnail_video/<clip>/``."""

    clip_dir = LOCAL_BASE_DIR / clip_id
    maps = _read_meta_mp4_maps(clip_dir)
    if maps is None:
        print(f"[WARN] 缩略视频跳过：{clip_id} 下未找到 meta.lance")
        return False
    resize, mp4_path = maps
    sensors = sorted({*resize.keys(), *mp4_path.keys()})
    if not sensors:
        print(f"[WARN] 缩略视频跳过：{clip_id} meta 中未记录任何 mp4")
        return False

    target_dir = THUMBNAIL_BASE_DIR / clip_id
    target_dir.mkdir(parents=True, exist_ok=True)
    active_endpoint = endpoint_override or OSS_CONFIG["endpoint"]

    jobs: list[tuple[str, str, str, Path, int, str | None]] = []
    skipped: list[str] = []
    for sensor in sensors:
        uri = _pick_sensor_uri(sensor, resize, mp4_path)
        parsed = _parse_oss_uri(uri) if uri else None
        if not parsed:
            skipped.append(f"{sensor} (no oss uri: {uri!r})")
            continue
        bucket_name, key = parsed
        target = target_dir / f"{sensor}.mp4"
        if target.exists() and target.stat().st_size > 0:
            skipped.append(f"{sensor} (已存在 {format_size(target.stat().st_size)})")
            continue
        jobs.append((bucket_name, key, f"{sensor}.mp4", target, 0, active_endpoint))

    print(
        f"\n[INFO] 缩略视频 {clip_id}: 待下载 {len(jobs)} 个, 跳过 {len(skipped)} 个"
    )
    for note in skipped:
        print(f"  - skip {note}")
    if not jobs:
        return True

    loop = asyncio.get_running_loop()
    ok_count = 0
    fail_count = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [
            loop.run_in_executor(executor, run_download_job, job)
            for job in jobs
        ]
        for completed in asyncio.as_completed(futures):
            ok, relative, _size, err = await completed
            if ok:
                ok_count += 1
                print(f"  [OK] {relative}")
            else:
                fail_count += 1
                print(f"  [FAIL] {relative} | {err}")

    if fail_count > 0:
        print(f"[WARN] 缩略视频 {clip_id}: 成功 {ok_count}/{len(jobs)}, 失败 {fail_count}")
        return False
    print(f"[OK]   缩略视频 {clip_id}: 全部 {ok_count} 个成功")
    return True


def _discover_existing_clip_ids() -> list[str]:
    if not LOCAL_BASE_DIR.exists():
        return []
    return sorted(
        p.name
        for p in LOCAL_BASE_DIR.iterdir()
        if p.is_dir() and p.name.startswith("c-") and (p / "meta.lance").exists()
    )


# ============================================================


async def main_async(args: argparse.Namespace) -> None:
    validate_config()

    if args.thumbnails_only:
        clip_ids = ID_LIST or _discover_existing_clip_ids()
        if not clip_ids:
            print("[WARN] 没有可用的 clip，请先下载 clip 数据或填充 tobe_download_list.json")
            sys.exit(0)
        print(f"[INFO] 仅下载缩略视频: 共 {len(clip_ids)} 个 clip")
        ok = 0
        for idx, cid in enumerate(clip_ids, start=1):
            print(f"\n{'=' * 60}")
            print(f"[{idx}/{len(clip_ids)}] Thumbnail for {cid}")
            if await download_thumbnails_for_clip(cid):
                ok += 1
        print(f"\n[DONE] 缩略视频: {ok}/{len(clip_ids)} 成功")
        return

    if not ID_LIST:
        print("[WARN] ID_LIST 为空，请在脚本顶部配置需要下载的 ID 列表后重新运行。")
        sys.exit(0)

    print(f"\n[INFO] 共 {len(ID_LIST)} 个 ID 待下载")
    print(f"[INFO] 本地根目录: {LOCAL_BASE_DIR.resolve()}")
    print(f"[INFO] 缩略视频根目录: {THUMBNAIL_BASE_DIR.resolve()}\n")

    success: list[str] = []
    failed: list[str] = []
    thumb_failed: list[str] = []

    for idx, id_ in enumerate(ID_LIST, start=1):
        print(f"{'=' * 60}")
        print(f"[{idx}/{len(ID_LIST)}] ID: {id_}")
        ok = await download_one(id_)
        (success if ok else failed).append(id_)
        if ok and not args.skip_thumbnails:
            if not await download_thumbnails_for_clip(id_):
                thumb_failed.append(id_)

    # 汇总报告
    print(f"\n{'=' * 60}")
    print(f"[DONE] 下载完成: {len(success)}/{len(ID_LIST)} 成功")
    if failed:
        print(f"[WARN] 以下 ID 下载失败:")
        for fid in failed:
            print(f"       - {fid}")
    if thumb_failed:
        print(f"[WARN] 以下 ID 缩略视频下载不完整:")
        for fid in thumb_failed:
            print(f"       - {fid}")
    if failed:
        sys.exit(1)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download OSS clip data + thumbnail videos.")
    parser.add_argument(
        "--thumbnails-only",
        action="store_true",
        help="仅下载缩略视频（需要 meta.lance 已存在于 data/lance/<clip>/）",
    )
    parser.add_argument(
        "--skip-thumbnails",
        action="store_true",
        help="只下载 clip 数据，不下载缩略视频",
    )
    return parser.parse_args()


def main() -> None:
    asyncio.run(main_async(_parse_args()))


if __name__ == "__main__":
    main()

