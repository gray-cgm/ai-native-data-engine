from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.catalog import router as catalog_router
from src.api.routes.export import router as export_router
from src.api.routes.health import router as health_router
from src.api.routes.operations import router as operations_router
from src.api.routes.samples import router as samples_router
from src.core.runtime import get_runtime_container

app = FastAPI(title='AI Native Data Engine API', version='0.1.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health_router)
app.include_router(samples_router)
app.include_router(catalog_router)
app.include_router(operations_router)
app.include_router(export_router)


@app.get('/')
def root() -> dict:
    container = get_runtime_container()
    return {
        'name': 'ai-native-data-engine-api',
        'data_dir': str(Path('data').resolve()),
        'profile': container.profile.name,
        'capabilities': container.capabilities.model_dump(),
    }
