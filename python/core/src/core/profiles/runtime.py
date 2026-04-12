from dataclasses import dataclass

from core.domain.models import ProfileCapabilities, RuntimeProfile
from core.interfaces.contracts import (
    AuthAdapter,
    ComputeAdapter,
    MetadataAdapter,
    QueryAdapter,
    SearchAdapter,
    StorageAdapter,
    TableAdapter,
)


@dataclass
class RuntimeContainer:
    profile: RuntimeProfile
    capabilities: ProfileCapabilities
    storage: StorageAdapter
    query: QueryAdapter
    compute: ComputeAdapter
    metadata: MetadataAdapter
    search: SearchAdapter
    auth: AuthAdapter
    table: TableAdapter
