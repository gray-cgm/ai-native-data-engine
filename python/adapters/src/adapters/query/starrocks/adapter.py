from typing import Any


class StarRocksQueryAdapter:
    def __init__(self, jdbc_url: str, database: str) -> None:
        self.jdbc_url = jdbc_url
        self.database = database

    def query(self, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        raise NotImplementedError('StarRocks adapter is reserved for enterprise-saas profile')

    def create_view(self, name: str, sql: str) -> None:
        raise NotImplementedError

    def register_table(self, name: str, source: str) -> None:
        raise NotImplementedError

    def materialize_table(self, name: str, sql: str) -> None:
        raise NotImplementedError

    def create_sample_table(self, records: list) -> None:
        raise NotImplementedError

    def query_distribution(self) -> list[dict[str, Any]]:
        raise NotImplementedError
