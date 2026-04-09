include .env
export

.PHONY: install install-web install-py dev dev-web dev-api dev-dagster ingest query lance export-parquet export-csv export-jsonl sdk-demo clean

install: install-web install-py

install-web:
	pnpm install

install-py:
	uv sync


dev:
	pnpm dev


dev-web:
	pnpm --filter web dev


dev-api:
	uv run --package api uvicorn src.main:app --reload --host $(API_HOST) --port $(API_PORT)


dev-dagster:
	uv run --package orchestrator dagster dev -f src/definitions.py -h 0.0.0.0 -p $(DAGSTER_PORT)


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
	uv run --package ad-sdk python -c "from ad_sdk import ADEngineClient; c = ADEngineClient(); print(c.list_datasets())"


clean:
	rm -rf .venv node_modules apps/web/node_modules packages/*/node_modules
