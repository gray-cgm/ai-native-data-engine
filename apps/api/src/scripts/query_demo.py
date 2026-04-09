from pathlib import Path
from pprint import pprint

from profiles import build_container
from workflows.assets.pipeline import materialize_local_assets


if __name__ == '__main__':
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    materialize_local_assets(container, Path('examples/datasets/custom-local'))
    pprint(container.query.query_distribution())
