-include .env
export

HOST_WORKSPACE_DIR := $(CURDIR)
COMPOSE_SERVICES := postgres dagster-user-code dagster-webserver dagster-daemon jupyter superset kafka kafka-ui
APP_PORTS := $(WEB_PORT) $(BFF_PORT) $(API_PORT) $(DAGSTER_PORT) $(POSTGRES_PORT) $(JUPYTER_PORT) $(SUPERSET_PORT) $(KAFKA_PORT) $(KAFKA_UI_PORT)
COLIMA_MOUNT_EXISTS := $(shell colima ssh -- test -d "$(HOST_WORKSPACE_DIR)" >/dev/null 2>&1 && echo yes || echo no)

.PHONY: setup preflight doctor check-env check-tools check-docker check-ports check-mount install install-web install-py up up-deps up-apps down logs status dev dev-web dev-bff dev-api dev-dagster compose-dagster restart-dagster compose-analytics kafka-down kafka-logs kafka-topics-init stream-kafka-consumer ingest query lance stream-demo stream-demo-kafka export-parquet export-csv export-jsonl sdk-demo req-demo req-list req-stats req-sign-off seed-trace-demo seed-trace-demo-reset e2e-demo e2e-demo-reset e2e-demo-random onboarding-01 onboarding-02 onboarding-03 onboarding-04 onboarding-05 onboarding-06 onboarding-07 onboarding-all db-upgrade db-downgrade db-stamp-head db-revision db-current db-history clean clean-dev-data

setup: check-tools check-docker
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	fi
	$(MAKE) install

preflight: check-tools check-env check-docker check-mount check-ports

doctor:
	@echo "Project root: $(HOST_WORKSPACE_DIR)"
	@echo "Docker context: $$(docker context show 2>/dev/null || echo unknown)"
	@echo "Colima status:" && colima status 2>/dev/null || true
	@echo "Docker daemon:" && docker info >/dev/null 2>&1 && echo "ok" || echo "unreachable"
	@echo "Workspace mount in Colima: $(COLIMA_MOUNT_EXISTS)"
	@echo "Expected ports: $(APP_PORTS)"
	@$(MAKE) check-ports || true

check-env:
	@if [ ! -f .env ]; then \
		echo "Missing .env. Run 'make setup' first."; \
		exit 1; \
	fi

check-tools:
	@command -v node >/dev/null || (echo "Missing node" && exit 1)
	@command -v pnpm >/dev/null || (echo "Missing pnpm" && exit 1)
	@command -v python3 >/dev/null || (echo "Missing python3" && exit 1)
	@command -v uv >/dev/null || (echo "Missing uv" && exit 1)
	@command -v docker >/dev/null || (echo "Missing docker" && exit 1)
	@docker compose version >/dev/null 2>&1 || (echo "Missing docker compose" && exit 1)

check-docker:
	@docker info >/dev/null 2>&1 || (echo "Docker daemon is not running" && exit 1)

check-mount:
	@if [ "$(COLIMA_MOUNT_EXISTS)" = "no" ]; then \
		echo "Colima cannot see $(HOST_WORKSPACE_DIR). Check ~/.colima/default/colima.yaml mounts and restart Colima."; \
		exit 1; \
	fi

check-ports:
	@python3 -c "import socket,sys; busy=[]; exec('for raw in sys.argv[1:]:\n    port=int(raw)\n    sock=socket.socket()\n    try:\n        sock.bind((\"0.0.0.0\", port))\n    except OSError:\n        busy.append(port)\n    finally:\n        sock.close()'); print('Ports already in use: ' + ', '.join(map(str, busy))) if busy else None; sys.exit(1 if busy else 0)" $(POSTGRES_PORT) $(DAGSTER_PORT) $(JUPYTER_PORT) $(SUPERSET_PORT) $(KAFKA_PORT) $(KAFKA_UI_PORT)

install: install-web install-py

install-web:
	pnpm install

install-py:
	uv sync


up: preflight up-deps up-apps

up-deps: check-env
	HOST_WORKSPACE_DIR="$(HOST_WORKSPACE_DIR)" docker compose up -d --build $(COMPOSE_SERVICES)

up-apps:
	@python3 -c "import socket,sys; busy=[]; exec('for raw in sys.argv[1:]:\n    port=int(raw)\n    sock=socket.socket()\n    try:\n        sock.bind((\"0.0.0.0\", port))\n    except OSError:\n        busy.append(port)\n    finally:\n        sock.close()'); print('App ports already in use: ' + ', '.join(map(str, busy))) if busy else None; sys.exit(1 if busy else 0)" $(WEB_PORT) $(BFF_PORT) $(API_PORT)
	@$(MAKE) status
	@echo "Starting local app processes..."
	@API_HOST=$(API_HOST) API_PORT=$(API_PORT) pnpm dev:local

down: down-apps
	HOST_WORKSPACE_DIR="$(HOST_WORKSPACE_DIR)" docker compose down

down-apps:
	@echo "Stopping local app processes..."
	@pkill -f "vite --host 0.0.0.0 --port $(WEB_PORT)" || true
	@pkill -f "tsx watch src/index.ts" || true
	@pkill -f "uv run --package api uvicorn src.main:app --app-dir apps/api --reload --host $(API_HOST) --port $(API_PORT)" || true
	
logs:
	HOST_WORKSPACE_DIR="$(HOST_WORKSPACE_DIR)" docker compose logs -f $(COMPOSE_SERVICES)

status:
	@echo "Web: http://localhost:$(WEB_PORT)"
	@echo "BFF: http://localhost:$(BFF_PORT)"
	@echo "API: http://localhost:$(API_PORT)/docs"
	@echo "Dagster: http://localhost:$(DAGSTER_PORT)"
	@echo "Jupyter: http://localhost:$(JUPYTER_PORT)"
	@echo "Superset: http://localhost:$(SUPERSET_PORT)"
	@echo "Kafka broker: localhost:$(KAFKA_PORT) (in-compose: kafka:9093)"
	@echo "Kafka UI: http://localhost:$(KAFKA_UI_PORT)"

dev:
	pnpm dev


dev-web:
	pnpm --filter web dev


dev-bff:
	pnpm --filter bff dev


dev-api:
	uv run --package api uvicorn src.main:app --app-dir apps/api --reload --host $(API_HOST) --port $(API_PORT)


dev-dagster:
	uv run --package orchestrator dagster dev -f src/definitions.py -h 0.0.0.0 -p $(DAGSTER_PORT)


# Dagster OSS Docker deployment: webserver + daemon + user-code gRPC.
compose-dagster:
	docker compose up --build dagster-user-code dagster-webserver dagster-daemon postgres


restart-dagster:
	docker compose restart dagster-user-code dagster-webserver dagster-daemon


compose-analytics:
	docker compose up --build jupyter superset postgres


# ── Kafka 运维（启动统一走 `make up-deps`） ──────────────────────────────
kafka-down:
	docker compose stop kafka kafka-ui

kafka-logs:
	docker compose logs -f kafka kafka-ui

# Pre-create streaming topics (works around lazy creation timing for consumers).
# Confluent cp-kafka exposes kafka-topics directly on PATH; in-container we hit
# the internal listener (kafka:9093) so this works on every architecture.
kafka-topics-init:
	@docker compose exec -T kafka kafka-topics --bootstrap-server kafka:9093 --create --if-not-exists --topic $${KAFKA_TOPIC_EVENTS:-streaming.events.raw} --partitions 3 --replication-factor 1
	@docker compose exec -T kafka kafka-topics --bootstrap-server kafka:9093 --create --if-not-exists --topic $${KAFKA_TOPIC_DLQ:-streaming.events.dlq} --partitions 1 --replication-factor 1
	@echo "Topics ensured: $${KAFKA_TOPIC_EVENTS:-streaming.events.raw}, $${KAFKA_TOPIC_DLQ:-streaming.events.dlq}"


ingest:
	uv run --package api python -m src.scripts.ingest_demo


query:
	uv run --package api python -m src.scripts.query_demo


lance:
	uv run --package api python -m src.scripts.lance_demo


# Default: emits to JSONL file (file-mode, no Kafka required).
stream-demo:
	uv run --package api python -m src.scripts.streaming_demo

# Publishes the streaming demo events to Kafka. Requires `make up-deps`.
stream-demo-kafka:
	STREAMING_DEMO_TARGET=kafka uv run --package api python -m src.scripts.streaming_demo

# Run the Kafka consumer (idempotent, with DLQ). Requires `make up-deps`.
# We cd into apps/orchestrator so `src.streaming.kafka_trigger` resolves from the
# repo's source tree directly (matches how Dagster loads `src/definitions.py` via -f).
stream-kafka-consumer:
	cd apps/orchestrator && uv run --package orchestrator python -m src.streaming.kafka_trigger


export-parquet:
	curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=parquet"


export-csv:
	curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=csv"


export-jsonl:
	curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=jsonl"


sdk-demo:
	uv run --package ad-sdk python -c "from ad_sdk import ADEngineClient; c = ADEngineClient(); print(c.get_scenario_summary())"


# ── 需求管理系统 demo scripts ────────────────────────────────────────────────

# 创建 demo 需求 + 数据任务（需要 API 已启动：make dev-api）
req-demo:
	uv run --package api python -m src.scripts.requirements_demo seed

# 列出所有需求
req-list:
	uv run --package api python -m src.scripts.requirements_demo list

# 查看需求统计
req-stats:
	uv run --package api python -m src.scripts.requirements_demo stats

# 对首个 pending 任务执行 approve
req-sign-off:
	uv run --package api python -m src.scripts.requirements_demo sign-off

# 全链路 (Requirement → DataTask → OperationsTask → PipelineRun) 随机 demo 数据
seed-trace-demo:
	uv run --package api python -m src.scripts.seed_trace_demo $(ARGS)

# 清空后重新生成：make seed-trace-demo-reset ARGS="--requirements 3 --seed 42"
seed-trace-demo-reset:
	uv run --package api python -m src.scripts.seed_trace_demo --reset $(ARGS)


# ── 端到端自驾 demo（8 步贯穿 + 链路 receipt） ─────────────────────────────
# 一键贯穿 Requirement → DataTask → Mining → Pipeline(batch+streaming) →
# Labeling/Tagging/Checking → Explorer → Release → Catalog → Export，
# 输出 trace_id + receipt JSON + Web/API 验证 URL。
#
# 推荐用法：
#   make e2e-demo                                 # 随机场景
#   make e2e-demo SCENARIO=night-vru SEED=42      # 指定场景 + 复现
#   make e2e-demo INCLUDE_STREAMING=0             # 跳过 streaming 步骤
#   make e2e-demo-reset                           # 跑前清空 e2e 旧数据
#   make e2e-demo-random ARGS="--format jsonl"    # 透传额外参数
#
# 软依赖：Kafka broker 不可达时 streaming 自动降级到 file-mode（不阻断）。
e2e-demo:
	uv run --package api python -m src.scripts.e2e_demo $(ARGS)

e2e-demo-reset:
	uv run --package api python -m src.scripts.e2e_demo --reset $(ARGS)

e2e-demo-random:
	SCENARIO=random uv run --package api python -m src.scripts.e2e_demo $(ARGS)


# ── Onboarding：新人入职 7 个分层 demo ─────────────────────────────────────
# 详见 apps/api/src/scripts/onboarding/README.md
ONB = uv run --package api python -m src.scripts.onboarding

onboarding-01:
	$(ONB).s01_lance_format $(ARGS)

onboarding-02:
	$(ONB).s02_storage_adapter $(ARGS)

onboarding-03:
	$(ONB).s03_duckdb_query $(ARGS)

onboarding-04:
	$(ONB).s04_business_flow --reset $(ARGS)

onboarding-05:
	$(ONB).s05_dataset_sample --reset $(ARGS)

onboarding-06:
	$(ONB).s06_snowflake_lineage --reset $(ARGS)

onboarding-07:
	$(ONB).s07_promote_export --reset $(ARGS)

onboarding-all: onboarding-01 onboarding-02 onboarding-03 onboarding-04 onboarding-05 onboarding-06 onboarding-07
	@echo "✅ Onboarding 7 个 demo 全部跑完"


# ── Alembic 数据库迁移 ──────────────────────────────────────────────────────
# 约定：在 apps/api 目录下执行 alembic；使用 DATABASE_URL 环境变量控制目标库。
# 本地无需传参（默认指向 <repo_root>/data/metadata/requirement.db）；
# 生产通过 export DATABASE_URL=... 后再执行。
ALEMBIC_DB_URL ?= sqlite:///$(CURDIR)/data/metadata/requirement.db
ALEMBIC = cd apps/api && DATABASE_URL="$(ALEMBIC_DB_URL)" uv run --package api alembic

# 升级到最新版本（首次初始化数据库推荐执行）
db-upgrade:
	$(ALEMBIC) upgrade head

# 回滚 N 步：make db-downgrade REV=-1
db-downgrade:
	$(ALEMBIC) downgrade $(REV)

# 为已存在的数据库标记当前为最新版本（不执行任何 DDL）：从 create_all 迁移到 alembic 时使用
db-stamp-head:
	$(ALEMBIC) stamp head

# 基于模型变更自动生成迁移：make db-revision MSG="add foo column"
db-revision:
	$(ALEMBIC) revision --autogenerate -m "$(MSG)"

# 显示当前数据库版本
db-current:
	$(ALEMBIC) current

# 显示迁移历史
db-history:
	$(ALEMBIC) history --verbose


clean:
	rm -rf .venv node_modules apps/web/node_modules packages/*/node_modules


clean-dev-data:
	bash apps/api/src/scripts/clean-dev-data.sh --yes
