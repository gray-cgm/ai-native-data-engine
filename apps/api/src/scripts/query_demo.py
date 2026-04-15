from pathlib import Path
from pprint import pprint

from profiles import build_container
from services import get_scenario_triage_summary, run_scenario_triage


if __name__ == '__main__':
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    run_scenario_triage(container)
    pprint(get_scenario_triage_summary(container))
