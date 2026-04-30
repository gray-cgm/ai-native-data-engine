"""02 · 存储层（Storage Adapter）

🎯 目标
   学会用 StorageAdapter 抽象做"字节读写"，理解 profile 切换 backend 不改代码的原则。

📖 知识点
   - StorageAdapter 抽象在 ``python/core/src/core/interfaces/contracts.py``
   - 当前两个实现：LocalFileStorageAdapter（本地 fs）/ S3StorageAdapter（boto3）
   - 操作语义：put/get/list/delete + open（流式）
   - 未来规划：OpenDALStorageAdapter 统一接管 30+ 后端（见 adr/tech-selection-datafusion-opendal.md）
   - 写应用代码时不要直接 boto3 / open(...)；走 adapter 才能在 personal/team/SaaS 间切换

🚀 跑法
   uv run --package api python -m src.scripts.onboarding.s02_storage_adapter
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from adapters.storage.local_fs.adapter import LocalFileStorageAdapter

from src.scripts.onboarding._console import banner, done, end_banner, hr, info, kv, step


SANDBOX = Path("data/onboarding/storage_demo")


def main(sandbox: Path) -> None:
    banner(
        "02 · 存储层（Storage Adapter）",
        f"沙盒目录 {sandbox}（demo 结束自动清理）",
    )

    sandbox.mkdir(parents=True, exist_ok=True)
    adapter = LocalFileStorageAdapter()

    # ─── Step 1：put_file ──────────────────────────────────────────
    step(1, "put_file", "把本地临时文件「上传」到 sandbox（local fs adapter 实际是 mv/cp）")

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt") as tmp:
        tmp.write("hello, ai data loop engine!\n")
        tmp.write("这一行用来演示 put_file 的字节写入。\n")
        local_src = Path(tmp.name)
    info(f"本地源文件：{local_src} ({local_src.stat().st_size} bytes)")

    target_uri = str(sandbox / "greeting.txt")
    saved_uri = adapter.put_file(local_src, target_uri)
    kv("saved at", saved_uri)
    kv("exists?", adapter.exists(saved_uri))

    # ─── Step 2：list ──────────────────────────────────────────────
    step(2, "list", "列举 prefix 下所有文件 URI（StorageAdapter 不关心 ./ 前缀）")
    listed = adapter.list(str(sandbox))
    for uri in listed:
        kv("uri", uri)

    # ─── Step 3：get_file ──────────────────────────────────────────
    step(3, "get_file", "把 sandbox 文件「下载」回本地（生产环境是从 S3/OSS 拉到本地）")
    out_path = sandbox / "downloaded.txt"
    adapter.get_file(saved_uri, out_path)
    kv("downloaded to", out_path)
    kv("size", f"{out_path.stat().st_size} bytes")
    info("内容预览：")
    print("    " + out_path.read_text().replace("\n", "\n    ").rstrip())

    # ─── Step 4：open() 流式读 ────────────────────────────────────
    step(4, "open()", "流式读：大文件 / 视频 range read 用这个，避免一次性 load")
    with adapter.open(saved_uri, "rb") as fh:
        head = fh.read(20)
    kv("first 20 bytes", head)

    # ─── Step 5：delete ────────────────────────────────────────────
    step(5, "delete", "清理：local fs 实际是 unlink，S3 是 DeleteObject")
    adapter.delete(saved_uri)
    adapter.delete(str(out_path))
    kv("greeting still exists?", adapter.exists(saved_uri))

    # ─── 知识总结 ───────────────────────────────────────────────────
    hr()
    info("📐 抽象边界（设计取舍）：")
    info("  - StorageAdapter 只管「字节」，不管表 / 行 / schema → 那是 TableAdapter 的事")
    info("  - 所有 path 用 URI 字符串而不是 Path：S3 / OSS 后端不是文件系统")
    info("  - profile.storage.driver 切换：local | s3 | (将来) opendal")
    info("  - 在线调试：python -c \"from adapters.storage.local_fs.adapter import LocalFileStorageAdapter as A; print(A().list('data/'))\"")

    # 打扫沙盒
    try:
        sandbox.rmdir()
    except OSError:
        pass

    done("storage adapter 5 个核心 API 都跑通")
    info("下一步：运行 s03_duckdb_query.py 看「字节怎么变成可 SQL 的表」")
    end_banner("Storage Adapter ✓")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboarding 02: Storage adapter")
    parser.add_argument("--sandbox", default=str(SANDBOX))
    args = parser.parse_args()
    try:
        main(Path(args.sandbox))
    except Exception as exc:  # noqa: BLE001
        print(f"\n❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
