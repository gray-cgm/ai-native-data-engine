from pathlib import Path
from pprint import pprint

from profiles import build_container
from services import run_scenario_triage


if __name__ == '__main__':
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    result = run_scenario_triage(container)
    pprint(result)
