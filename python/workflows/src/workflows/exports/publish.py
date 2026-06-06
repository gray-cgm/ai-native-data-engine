"""把导出 artifact 通过 StorageAdapter 发布到任意后端（fs / s3 / oss …）。

分工对齐 ADR：TableAdapter（Lance/Parquet）把 artifact 写到本地，storage 负责上云。
``target_uri`` 是 storage 的 key（不是 scheme URL）——OpenDAL adapter 会按其 base 归一，
故 ``./data/exports/v1.lance`` 在 ``opendal(scheme=s3, base=./data)`` 下落为 s3 key ``exports/v1.lance``。
Lance 导出是目录，单 parquet/jsonl 是文件，两种都支持。
"""

from pathlib import Path

from core.interfaces.contracts import StorageAdapter


def publish_export(storage: StorageAdapter, local_path: Path | str, target_uri: str) -> list[str]:
    local_path = Path(local_path)
    if local_path.is_file():
        return [storage.put_file(local_path, target_uri)]
    base = target_uri.rstrip('/')
    published = []
    for file in sorted(p for p in local_path.rglob('*') if p.is_file()):
        rel = file.relative_to(local_path).as_posix()
        published.append(storage.put_file(file, f'{base}/{rel}'))
    return published
