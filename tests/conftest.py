"""共享 fixtures。单测零外部依赖；集成测试连 MinIO，不可达则显式 skip。"""

import os

import pytest

from adapters.storage.local_fs.adapter import LocalFileStorageAdapter
from adapters.storage.opendal.adapter import OpenDALStorageAdapter

MINIO_ENDPOINT = os.environ.get('MINIO_ENDPOINT', 'http://localhost:9000')
MINIO_BUCKET = os.environ.get('MINIO_BUCKET', 'ad-data')
MINIO_KEY = os.environ.get('MINIO_ROOT_USER', 'minioadmin')
MINIO_SECRET = os.environ.get('MINIO_ROOT_PASSWORD', 'minioadmin')


def _make(kind: str, root: str):
    if kind == 'local_fs':
        return LocalFileStorageAdapter()
    if kind == 'opendal_fs':
        return OpenDALStorageAdapter('fs', root=root)
    raise ValueError(kind)


@pytest.fixture(params=['local_fs', 'opendal_fs'])
def storage(request, tmp_path):
    """Contract fixture：同一组用例跑 local_fs 与 opendal(fs) 两实现，断言行为一致。"""
    return _make(request.param, str(tmp_path)), tmp_path


@pytest.fixture
def opendal_fs(tmp_path):
    return OpenDALStorageAdapter('fs', root=str(tmp_path)), tmp_path


@pytest.fixture
def minio_storage():
    """OpenDAL s3 → MinIO。连不通就 skip（不伪 pass）。"""
    import opendal

    base = os.environ.get('MINIO_BASE', './data')
    adapter = OpenDALStorageAdapter(
        's3',
        root=base,
        bucket=MINIO_BUCKET,
        endpoint=MINIO_ENDPOINT,
        region='us-east-1',
        access_key_id=MINIO_KEY,
        secret_access_key=MINIO_SECRET,
    )
    try:
        adapter._op.stat('__healthcheck_probe__')
    except opendal.exceptions.NotFound:
        pass  # bucket 可达，对象不存在 → 正常
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f'MinIO 不可达（{MINIO_ENDPOINT}）：{type(exc).__name__}')
    return adapter
