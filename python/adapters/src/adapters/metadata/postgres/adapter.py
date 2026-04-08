from core.domain.models import LineageEvent


class PostgresMetadataAdapter:
    def __init__(self) -> None:
        self.datasets: dict[str, dict] = {}
        self.dataset_versions: dict[str, list[dict]] = {}
        self.job_runs: list[dict] = []
        self.lineage_events: list[dict] = []

    def create_dataset(self, payload: dict) -> dict:
        dataset_id = str(payload['dataset_id'])
        self.datasets[dataset_id] = payload
        return payload

    def get_dataset(self, dataset_id: str) -> dict | None:
        return self.datasets.get(dataset_id)

    def create_dataset_version(self, payload: dict) -> dict:
        dataset_id = str(payload['dataset_id'])
        self.dataset_versions.setdefault(dataset_id, []).append(payload)
        return payload

    def list_dataset_versions(self, dataset_id: str) -> list[dict]:
        return self.dataset_versions.get(dataset_id, [])

    def create_job_run(self, payload: dict) -> dict:
        self.job_runs.append(payload)
        return payload

    def append_lineage_event(self, payload: LineageEvent) -> dict:
        event = payload.model_dump()
        self.lineage_events.append(event)
        return event
