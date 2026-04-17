from datetime import UTC, datetime

from core.domain.models import ComputeRun


class DagsterLocalComputeAdapter:
    def submit_job(self, job_name: str, payload: dict) -> ComputeRun:
        return ComputeRun(
            run_id=f'dagster-{job_name}-{datetime.now(UTC).strftime("%Y%m%d%H%M%S%f")}',
            status='success',
            metadata={
                **payload,
                'execution_engine': 'dagster-local',
            },
        )

    def get_run(self, run_id: str) -> ComputeRun:
        return ComputeRun(run_id=run_id, status='success', metadata={})

    def cancel_run(self, run_id: str) -> None:
        return None
