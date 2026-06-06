"""OpenDALStorageAdapter 专属行为：key 归一 / range read(seek) / auto-mkdir / 超集能力。"""

import os


def test_key_normalization_strips_base(tmp_path):
    from adapters.storage.opendal.adapter import OpenDALStorageAdapter

    st = OpenDALStorageAdapter('fs', root='./data')
    assert st._key('./data/exports/v1.lance') == os.path.join('exports', 'v1.lance')
    assert st._key('./data/a/b/c.json') == os.path.join('a', 'b', 'c.json')


def test_open_w_auto_creates_parent(opendal_fs):
    """opendal open('w') 自动建父目录——local_fs 不会，是行为超集（clips/export 依赖）。"""
    st, root = opendal_fs
    uri = str(root / 'deep' / 'nested' / 'x.json')
    with st.open(uri, 'w') as h:
        h.write('{}')
    assert (root / 'deep' / 'nested' / 'x.json').read_text() == '{}'


def test_range_read_via_seek(opendal_fs):
    """clips 视频 range read 的底层路径：seek(start) + 顺序读，覆盖偏移/长度边界。"""
    st, root = opendal_fs
    payload = bytes(range(256)) * 8  # 2048 bytes，内容可定位
    (root / 'video.bin').write_bytes(payload)
    uri = str(root / 'video.bin')

    start, length = 300, 50
    with st.open(uri, 'rb') as fh:
        fh.seek(start)
        chunk = fh.read(length)
    assert chunk == payload[start:start + length]
    assert st.size(uri) == len(payload)


def test_range_read_to_eof(opendal_fs):
    st, root = opendal_fs
    payload = b'abcdefghij'
    (root / 'f.bin').write_bytes(payload)
    with st.open(str(root / 'f.bin'), 'rb') as fh:
        fh.seek(7)
        assert fh.read(100) == b'hij'  # 读到 EOF 截断
