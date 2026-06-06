from pathlib import Path


class LocalFileStorageAdapter:
    def list_files(self, root: Path) -> list[Path]:
        return sorted([path for path in root.rglob('*') if path.is_file()])

    def put_file(self, local_path: Path, target_uri: str) -> str:
        target = Path(target_uri)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(local_path.read_bytes())
        return str(target)

    def get_file(self, source_uri: str, local_path: Path) -> Path:
        source = Path(source_uri)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(source.read_bytes())
        return local_path

    def exists(self, uri: str) -> bool:
        return Path(uri).exists()

    def size(self, uri: str) -> int:
        return Path(uri).stat().st_size

    def list(self, prefix: str) -> list[str]:
        root = Path(prefix)
        return [str(path) for path in self.list_files(root)] if root.exists() else []

    def open(self, uri: str, mode: str = 'rb'):
        return Path(uri).open(mode)

    def delete(self, uri: str) -> None:
        path = Path(uri)
        if path.exists():
            path.unlink()
