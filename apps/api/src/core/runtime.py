from functools import lru_cache
from pathlib import Path

from profiles import build_container


@lru_cache(maxsize=1)
def get_runtime_container():
    return build_container(Path('infra/profiles/local-dev.yaml'))
