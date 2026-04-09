from core.domain.models import ComputeRun


class DagsterLocalComputeAdapter:
    def submit_job(self, job_name: str, payload: dict) -> ComputeRun:
        return ComputeRun(run_id=f'dagster-{job_name}', status='queued', metadata=payload)

    def get_run(self, run_id: str) -> ComputeRun:
        return ComputeRun(run_id=run_id, status='running', metadata={})

    def cancel_run(self, run_id: str) -> None:
        return None
