import httpx


class ADEngineClient:
    def __init__(self, base_url: str = 'http://localhost:8000') -> None:
        self.base_url = base_url.rstrip('/')

    def ingest_demo(self) -> dict:
        return httpx.post(f'{self.base_url}/samples/ingest-demo', timeout=30).json()

    def get_scenario_summary(self) -> dict:
        return httpx.get(f'{self.base_url}/samples/distribution', timeout=30).json()

    def list_datasets(self) -> dict:
        return httpx.get(f'{self.base_url}/datasets', timeout=30).json()

    def get_dataset(self, dataset_id: str) -> dict:
        return httpx.get(f'{self.base_url}/datasets/{dataset_id}', timeout=30).json()

    def list_exports(self) -> dict:
        return httpx.get(f'{self.base_url}/exports', timeout=30).json()

    def export_dataset(self, dataset_id: str, format: str = 'parquet') -> dict:
        return httpx.post(f'{self.base_url}/exports/dataset/{dataset_id}', params={'format': format}, timeout=30).json()

    def search_preview(self) -> dict:
        return httpx.get(f'{self.base_url}/samples/search-preview', timeout=30).json()
