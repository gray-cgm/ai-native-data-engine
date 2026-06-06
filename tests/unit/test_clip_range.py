"""clips 视频路由的 HTTP Range 解析 + 经 StorageAdapter 的 range 流式（用例1 核心逻辑）。"""

import pytest

clips = pytest.importorskip('src.api.routes.clips', reason='apps/api import path 不可用时跳过')


@pytest.mark.parametrize(
    'header,size,expected',
    [
        ('bytes=0-99', 1000, (0, 99)),
        ('bytes=500-', 1000, (500, 999)),         # 缺 end → 到文件尾
        ('bytes=900-5000', 1000, (900, 999)),     # end 超界 → 截到 size-1
        ('bytes=1000-1100', 1000, None),          # start 越界 → None
        (None, 1000, None),                       # 无 header
        ('garbage', 1000, None),                  # 非法
    ],
)
def test_parse_range(header, size, expected):
    assert clips._parse_range(header, size) == expected


def test_storage_range_stream_matches_slice(opendal_fs):
    """复刻 stream_video 的 iter_chunk：storage.open + seek 出来的字节 == 原始切片。"""
    st, root = opendal_fs
    payload = bytes((i * 7) % 256 for i in range(4096))
    (root / 'v.mp4').write_bytes(payload)
    uri = str(root / 'v.mp4')

    file_size = st.size(uri)
    start, end = clips._parse_range('bytes=1000-2047', file_size)
    length = end - start + 1

    out = bytearray()
    with st.open(uri, 'rb') as fh:
        fh.seek(start)
        remaining = length
        while remaining > 0:
            buf = fh.read(min(512, remaining))
            if not buf:
                break
            remaining -= len(buf)
            out.extend(buf)
    assert bytes(out) == payload[start:end + 1]
