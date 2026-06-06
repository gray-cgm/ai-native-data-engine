"""集成测试：OpenDAL s3 → MinIO 全链路（write/read/range/size/list/delete）。

需要 docker MinIO 运行（`docker compose up minio minio-setup`）。不可达时 conftest 的
``minio_storage`` fixture 会显式 skip。默认 `pytest` 不跑（被 -m "not integration" 排除），
显式 `uv run pytest -m integration` 才执行。
"""

import pytest

pytestmark = pytest.mark.integration


def test_minio_put_get_size(minio_storage, tmp_path):
    src = tmp_path / 'blob.bin'
    src.write_bytes(b'minio-roundtrip')
    minio_storage.put_file(src, './data/it/blob.bin')
    assert minio_storage.exists('./data/it/blob.bin')
    assert minio_storage.size('./data/it/blob.bin') == len(b'minio-roundtrip')
    out = minio_storage.get_file('./data/it/blob.bin', tmp_path / 'back.bin')
    assert out.read_bytes() == b'minio-roundtrip'
    minio_storage.delete('./data/it/blob.bin')


def test_minio_range_read(minio_storage, tmp_path):
    payload = bytes(range(256)) * 8
    src = tmp_path / 'v.bin'
    src.write_bytes(payload)
    minio_storage.put_file(src, './data/it/v.bin')
    with minio_storage.open('./data/it/v.bin', 'rb') as fh:
        fh.seek(300)
        chunk = fh.read(50)
    assert chunk == payload[300:350]
    minio_storage.delete('./data/it/v.bin')


def test_minio_publish_export_tree(minio_storage, tmp_path):
    from workflows.exports import publish_export

    export = tmp_path / 'export'
    (export / 'data').mkdir(parents=True)
    (export / 'data' / 'part-0.parquet').write_bytes(b'PARQ0')
    (export / '_versions').mkdir()
    (export / '_versions' / '1.txt').write_text('v1')

    keys = publish_export(minio_storage, export, './data/exports/v1.lance')
    assert len(keys) == 2
    assert minio_storage.exists('./data/exports/v1.lance/data/part-0.parquet')
    for k in ['./data/exports/v1.lance/data/part-0.parquet', './data/exports/v1.lance/_versions/1.txt']:
        minio_storage.delete(k)
