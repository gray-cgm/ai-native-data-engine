from functools import lru_cache
from pathlib import Path

from profiles import build_container


def _default_profile_path() -> Path:
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / 'infra/profiles/local-dev.yaml'


@lru_cache(maxsize=1)
def get_runtime_container():
    return build_container(_default_profile_path())
