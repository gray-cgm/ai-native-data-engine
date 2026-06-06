from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.middleware.x_trace import XTraceMiddleware
from src.api.routes.catalog import router as catalog_router
from src.api.routes.clips import router as clips_router
from src.api.routes.assets import router as assets_router
from src.api.routes.data_tasks import router as data_tasks_router
from src.api.routes.datasets import router as datasets_router
from src.api.routes.events import router as events_router
from src.api.routes.exports import router as exports_router
from src.api.routes.health import router as health_router
from src.api.routes.operations import router as operations_router
from src.api.routes.labeling_annotations import router as labeling_annotations_router
from src.api.routes.ops_modules import router as ops_modules_router
from src.api.routes.pipelines import router as pipelines_router
from src.api.routes.requirements import router as requirements_router
from src.api.routes.samples import router as samples_router
from src.api.routes.snapshots import router as snapshots_router
from src.api.routes.streaming import router as streaming_router
from src.api.routes.tools import router as tools_router
from src.core.database import init_db
from src.core.runtime import get_runtime_container

app = FastAPI(title='AI Native Data Engine API', version='0.1.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
    expose_headers=['X-Trace-Id'],
)
app.add_middleware(XTraceMiddleware)

app.include_router(health_router)
app.include_router(samples_router)
app.include_router(streaming_router)
app.include_router(catalog_router)
app.include_router(clips_router)
app.include_router(operations_router)
# labeling 标注闭环：必须在通用 ops_modules_router 之前，避免 /annotations 被 /{item_id} 抢匹配
app.include_router(labeling_annotations_router)
app.include_router(ops_modules_router)
app.include_router(tools_router)

# ── 数据闭环需求管理系统路由 ──
app.include_router(requirements_router)
app.include_router(data_tasks_router)
app.include_router(pipelines_router)
app.include_router(snapshots_router)
app.include_router(datasets_router)
app.include_router(events_router)
app.include_router(assets_router)
app.include_router(exports_router)


@app.on_event('startup')
def on_startup():
    """启动时初始化数据库表结构（幂等）"""
    init_db()


@app.get('/')
def root() -> dict:
    container = get_runtime_container()
    return {
        'name': 'ai-native-data-engine-api',
        'data_dir': str(Path('data').resolve()),
        'profile': container.profile.name,
        'capabilities': container.capabilities.model_dump(),
    }
