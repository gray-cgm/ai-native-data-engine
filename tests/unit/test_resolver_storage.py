"""profile → storage adapter 装配：默认 local_fs 不变 + opendal 分支正确路由。"""

from pathlib import Path

import yaml


def _write_profile(tmp_path, storage_block):
    base = yaml.safe_load(Path('infra/profiles/local-dev.yaml').read_text())
    base['storage'] = storage_block
    p = tmp_path / 'p.yaml'
    p.write_text(yaml.safe_dump(base))
    return p


def test_local_dev_profile_stays_local_fs():
    from profiles.resolver import build_container

    c = build_container(Path('infra/profiles/local-dev.yaml'))
    assert type(c.storage).__name__ == 'LocalFileStorageAdapter'


def test_opendal_fs_branch(tmp_path):
    from profiles.resolver import build_container

    p = _write_profile(tmp_path, {'provider': 'opendal', 'scheme': 'fs', 'root': './data'})
    c = build_container(p)
    assert type(c.storage).__name__ == 'OpenDALStorageAdapter'
    # 装配出来的 adapter 真能读写，落点在 ./data 下
    import json

    uri = './data/exports/_resolver_smoke.json'
    with c.storage.open(uri, 'w') as h:
        json.dump({'ok': True}, h)
    assert c.storage.exists(uri)
    assert Path('data/exports/_resolver_smoke.json').exists()
    c.storage.delete(uri)


def test_opendal_s3_branch_constructs(tmp_path):
    """s3 scheme 离线构造（不连 MinIO）：验证 options 透传 + key 归一。"""
    from profiles.resolver import build_container

    p = _write_profile(
        tmp_path,
        {
            'provider': 'opendal',
            'scheme': 's3',
            'root': './data',
            'bucket': 'ad-data',
            'endpoint': 'http://localhost:9000',
            'region': 'us-east-1',
            'access_key_id': 'minioadmin',
            'secret_access_key': 'minioadmin',
        },
    )
    c = build_container(p)
    assert type(c.storage).__name__ == 'OpenDALStorageAdapter'
    assert c.storage._key('./data/exports/v1.lance').endswith('exports/v1.lance')
