from pydantic import BaseModel

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


class RuntimeContainer(BaseModel):
    profile: RuntimeProfile
    capabilities: ProfileCapabilities
    storage: StorageAdapter
    query: QueryAdapter
    compute: ComputeAdapter
    metadata: MetadataAdapter
    search: SearchAdapter
    auth: AuthAdapter
    table: TableAdapter

    model_config = {
        'arbitrary_types_allowed': True,
    }
