from pathlib import Path
from pprint import pprint

from profiles import build_container
from workflows.streaming import generate_demo_stream_events, run_local_streaming_demo


if __name__ == '__main__':
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    event_log_path = generate_demo_stream_events()
    summary = run_local_streaming_demo(container, event_log_path=event_log_path)
    pprint(summary)