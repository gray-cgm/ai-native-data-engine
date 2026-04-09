from pathlib import Path


class S3StorageAdapter:
    def __init__(self, bucket: str, region: str | None = None) -> None:
        self.bucket = bucket
        self.region = region

    def list_files(self, root: Path) -> list[Path]:
        raise NotImplementedError('S3 storage adapter is reserved for non-local profiles')

    def put_file(self, local_path: Path, target_uri: str) -> str:
        raise NotImplementedError

    def get_file(self, source_uri: str, local_path: Path) -> Path:
        raise NotImplementedError

    def exists(self, uri: str) -> bool:
        raise NotImplementedError

    def list(self, prefix: str) -> list[str]:
        raise NotImplementedError

    def open(self, uri: str, mode: str = 'rb'):
        raise NotImplementedError

    def delete(self, uri: str) -> None:
        raise NotImplementedError
