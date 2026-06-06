import io
import os
from pathlib import Path
from typing import BinaryIO

import opendal
from opendal.exceptions import NotFound


class OpenDALStorageAdapter:
    """StorageAdapter backed by Apache OpenDAL（一套 API 打通 fs / s3 / oss / gcs / azblob …）。

    与 ``LocalFileStorageAdapter`` 行为对齐，可在 profile 中通过
    ``storage.provider: opendal`` + ``scheme`` 切换后端，不改调用方代码。

    incoming uri 统一按 ``relpath(abspath(uri), abspath(base))`` 归一为 operator 相对 key：
    ``base`` 默认等于 ``root``，因此 fs 下 ``root/key`` 精确还原原始路径，cloud 下 cwd 前缀相互抵消，
    ``./data/exports/x.json`` → key ``exports/x.json``。
    """

    def __init__(self, scheme: str, root: str = '.', *, base: str | None = None, **options) -> None:
        self._scheme = scheme
        self._base_abs = os.path.abspath(base if base is not None else root)
        if scheme == 'fs':
            options['root'] = os.path.abspath(root)
        elif 'root' not in options:
            options['root'] = '/'
        self._op = opendal.Operator(scheme, **options)

    def _key(self, uri) -> str:
        return os.path.relpath(os.path.abspath(str(uri)), self._base_abs)

    def list_files(self, root: Path) -> list[Path]:
        key_root = self._key(root)
        list_path = '' if key_root in ('.', '') else key_root.rstrip('/') + '/'
        try:
            entries = self._op.list(list_path, recursive=True)
        except NotFound:
            return []
        files = []
        for entry in entries:
            if entry.path.endswith('/'):
                continue
            subpath = os.path.relpath(entry.path, key_root) if key_root not in ('.', '') else entry.path
            files.append(Path(root) / subpath)
        return sorted(files)

    def put_file(self, local_path: Path, target_uri: str) -> str:
        self._op.write(self._key(target_uri), Path(local_path).read_bytes())
        return str(target_uri)

    def get_file(self, source_uri: str, local_path: Path) -> Path:
        data = self._op.read(self._key(source_uri))
        local_path = Path(local_path)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(bytes(data))
        return local_path

    def exists(self, uri: str) -> bool:
        try:
            return self._op.exists(self._key(uri))
        except NotFound:
            return False

    def size(self, uri: str) -> int:
        return self._op.stat(self._key(uri)).content_length

    def list(self, prefix: str) -> list[str]:
        return [str(path) for path in self.list_files(Path(prefix))]

    def open(self, uri: str, mode: str = 'rb') -> BinaryIO:
        key = self._key(uri)
        if 'b' in mode:
            return self._op.open(key, mode)
        bin_mode = 'wb' if ('w' in mode or 'a' in mode) else 'rb'
        return io.TextIOWrapper(self._op.open(key, bin_mode), encoding='utf-8')

    def delete(self, uri: str) -> None:
        self._op.delete(self._key(uri))
