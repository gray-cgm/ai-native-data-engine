class IcebergTableAdapter:
    def create_table(self, name: str, schema: dict, partition_spec: dict | None = None) -> None:
        raise NotImplementedError('Iceberg adapter is reserved for enterprise-saas profile')

    def append(self, name: str, records: list[dict]) -> None:
        raise NotImplementedError

    def overwrite(self, name: str, records: list[dict]) -> None:
        raise NotImplementedError

    def read(self, name: str, filters: dict | None = None) -> list[dict]:
        raise NotImplementedError

    def snapshot(self, name: str) -> str:
        raise NotImplementedError
