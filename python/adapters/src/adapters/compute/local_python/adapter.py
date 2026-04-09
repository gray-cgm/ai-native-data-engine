from core.domain.models import ComputeRun


class LocalPythonComputeAdapter:
    def submit_job(self, job_name: str, payload: dict) -> ComputeRun:
        return ComputeRun(run_id=f'local-{job_name}', status='success', metadata=payload)

    def get_run(self, run_id: str) -> ComputeRun:
        return ComputeRun(run_id=run_id, status='success', metadata={})

    def cancel_run(self, run_id: str) -> None:
        return None
