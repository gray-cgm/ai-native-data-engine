-include .env
export

HOST_WORKSPACE_DIR := $(CURDIR)
COMPOSE_SERVICES := postgres dagster-user-code dagster-webserver dagster-daemon jupyter superset
APP_PORTS := $(WEB_PORT) $(BFF_PORT) $(API_PORT) $(DAGSTER_PORT) $(POSTGRES_PORT) $(JUPYTER_PORT) $(SUPERSET_PORT)
COLIMA_MOUNT_EXISTS := $(shell colima ssh -- test -d "$(HOST_WORKSPACE_DIR)" >/dev/null 2>&1 && echo yes || echo no)

.PHONY: setup preflight doctor check-env check-tools check-docker check-ports check-mount install install-web install-py up up-deps up-apps down logs status dev dev-web dev-bff dev-api dev-dagster compose-dagster restart-dagster compose-analytics compose-deps ingest query lance export-parquet export-csv export-jsonl sdk-demo clean clean-dev-data

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
	@python3 -c "import socket,sys; busy=[]; exec('for raw in sys.argv[1:]:\n    port=int(raw)\n    sock=socket.socket()\n    try:\n        sock.bind((\"0.0.0.0\", port))\n    except OSError:\n        busy.append(port)\n    finally:\n        sock.close()'); print('Ports already in use: ' + ', '.join(map(str, busy))) if busy else None; sys.exit(1 if busy else 0)" $(POSTGRES_PORT) $(DAGSTER_PORT) $(JUPYTER_PORT) $(SUPERSET_PORT)

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


# Start all containerized dependencies so apps can be developed locally against them.
compose-deps:
	docker compose up --build postgres dagster-user-code dagster-webserver dagster-daemon jupyter superset


ingest:
	uv run --package api python -m src.scripts.ingest_demo


query:
	uv run --package api python -m src.scripts.query_demo


lance:
	uv run --package api python -m src.scripts.lance_demo


export-parquet:
	curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=parquet"


export-csv:
	curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=csv"


export-jsonl:
	curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=jsonl"


sdk-demo:
	uv run --package ad-sdk python -c "from ad_sdk import ADEngineClient; c = ADEngineClient(); print(c.get_scenario_summary())"


clean:
	rm -rf .venv node_modules apps/web/node_modules packages/*/node_modules


clean-dev-data:
	bash apps/api/src/scripts/clean-dev-data.sh --yes
