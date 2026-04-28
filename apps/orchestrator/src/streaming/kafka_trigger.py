"""Kafka consumer for the streaming pipeline.

Wires a real Kafka source into the local-first streaming workflow with three
guarantees that are required for production-style observability:

1. **Idempotency / dedup** — a SQLite ledger keyed on
   ``(x_trace_id, event_id)`` skips re-delivered Kafka records and bumps a
   `duplicate_count` metric. `event_id` alone is also indexed so legacy
   producers without `x_trace_id` are still deduplicated.
2. **DLQ** — any record that fails to parse or process is republished to the
   configured DLQ topic with the original payload + error metadata
   (``error_class``, ``error_message``, ``original_topic``, ``offset``, etc.).
3. **Lag visibility** — every poll cycle persists per-partition lag and
   throughput counters to ``data/streaming/kafka_lag.json``, which the BFF
   surfaces via ``/pipelines/streaming-health``.

The consumer flushes successfully-processed events into the same Bronze JSONL
file that ``workflows.streaming.local_demo`` already consumes, so the existing
DuckDB / Lance / Gold materialization keeps working unchanged.

Run with::

    make stream-kafka-consumer
    # or
    uv run --package orchestrator python -m streaming.kafka_trigger
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sqlite3
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

try:
    from kafka import KafkaConsumer, KafkaProducer
    from kafka.errors import KafkaError, NoBrokersAvailable
    from kafka.structs import TopicPartition
except ImportError as exc:  # pragma: no cover — surfaced at runtime
    raise SystemExit(
        "kafka-python is required for the streaming consumer. "
        "Run `uv sync` to install dependencies."
    ) from exc


logger = logging.getLogger("streaming.kafka_trigger")

DEFAULT_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
DEFAULT_TOPIC = os.environ.get("KAFKA_TOPIC_EVENTS", "streaming.events.raw")
DEFAULT_DLQ_TOPIC = os.environ.get("KAFKA_TOPIC_DLQ", "streaming.events.dlq")
DEFAULT_GROUP_ID = os.environ.get("KAFKA_CONSUMER_GROUP", "ad-loop-streaming-consumer")


def _project_root() -> Path:
    # Anchor relative paths to the monorepo root (marker: pnpm-workspace.yaml).
    # The Makefile launches us via `cd apps/orchestrator && ...`, so cwd-relative
    # defaults would land under apps/orchestrator/data/ — invisible to the API
    # which reads from <repo-root>/data/.
    here = Path(__file__).resolve()
    for parent in (here, *here.parents):
        if (parent / "pnpm-workspace.yaml").exists():
            return parent
    return Path.cwd()


def _resolve_data_path(env_name: str, *parts: str) -> Path:
    override = os.environ.get(env_name)
    if override:
        return Path(override).expanduser()
    return _project_root().joinpath(*parts)


LEDGER_PATH = _resolve_data_path("STREAMING_LEDGER_PATH", "data", "streaming", "kafka_ledger.db")
LAG_SNAPSHOT_PATH = _resolve_data_path("STREAMING_LAG_PATH", "data", "streaming", "kafka_lag.json")
# 原 BRONZE_LOG_PATH，保留 env 别名向后兼容；新读 STREAMING_INGEST_LOG。
INGEST_LOG_PATH = _resolve_data_path(
    "STREAMING_INGEST_LOG",
    "data", "raw", "streaming", "local-events.jsonl",
) if "STREAMING_INGEST_LOG" in os.environ else _resolve_data_path(
    "STREAMING_BRONZE_LOG",
    "data", "raw", "streaming", "local-events.jsonl",
)


# ─────────────────────────────────────────────────────────────────────────────
# Dedup ledger
# ─────────────────────────────────────────────────────────────────────────────


class DedupLedger:
    """SQLite-backed idempotency ledger.

    Single-writer, designed for at-most-once side-effects in a local consumer.
    Stores ``(event_id, x_trace_id)`` plus partition+offset+timestamp for
    audit. Schema is created on first connect.
    """

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), isolation_level=None)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS processed_events (
                event_id      TEXT NOT NULL,
                x_trace_id    TEXT,
                requirement_id TEXT,
                topic         TEXT,
                partition     INTEGER,
                offset        INTEGER,
                processed_at  TEXT NOT NULL,
                PRIMARY KEY (event_id, x_trace_id)
            )
            """
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_processed_event_id ON processed_events(event_id)"
        )

    def seen(self, event_id: str, x_trace_id: str | None) -> bool:
        cur = self._conn.execute(
            "SELECT 1 FROM processed_events WHERE event_id = ? AND x_trace_id IS ?",
            (event_id, x_trace_id),
        )
        return cur.fetchone() is not None

    def remember(
        self,
        *,
        event_id: str,
        x_trace_id: str | None,
        requirement_id: str | None,
        topic: str,
        partition: int,
        offset: int,
    ) -> None:
        self._conn.execute(
            """
            INSERT OR IGNORE INTO processed_events
              (event_id, x_trace_id, requirement_id, topic, partition, offset, processed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                x_trace_id,
                requirement_id,
                topic,
                partition,
                offset,
                datetime.now(UTC).isoformat(),
            ),
        )

    def total(self) -> int:
        cur = self._conn.execute("SELECT COUNT(1) FROM processed_events")
        row = cur.fetchone()
        return int(row[0]) if row else 0

    def close(self) -> None:
        self._conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Counters / health snapshot
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class Counters:
    polled: int = 0
    accepted: int = 0
    duplicates: int = 0
    dlq: int = 0
    parse_errors: int = 0
    process_errors: int = 0
    last_event_at: str | None = None
    last_x_trace_id: str | None = None


@dataclass
class PartitionLag:
    topic: str
    partition: int
    current_offset: int
    end_offset: int
    lag: int


@dataclass
class HealthSnapshot:
    bootstrap_servers: str
    topic: str
    dlq_topic: str
    group_id: str
    counters: Counters
    partition_lag: list[PartitionLag] = field(default_factory=list)
    snapshot_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "bootstrap_servers": self.bootstrap_servers,
            "topic": self.topic,
            "dlq_topic": self.dlq_topic,
            "group_id": self.group_id,
            "counters": asdict(self.counters),
            "partition_lag": [asdict(p) for p in self.partition_lag],
            "total_lag": sum(p.lag for p in self.partition_lag),
            "snapshot_at": self.snapshot_at or datetime.now(UTC).isoformat(),
        }


# ─────────────────────────────────────────────────────────────────────────────
# Consumer
# ─────────────────────────────────────────────────────────────────────────────


class KafkaStreamingTrigger:
    """Long-running Kafka consumer for the streaming pipeline."""

    def __init__(
        self,
        *,
        bootstrap_servers: str = DEFAULT_BOOTSTRAP,
        topic: str = DEFAULT_TOPIC,
        dlq_topic: str = DEFAULT_DLQ_TOPIC,
        group_id: str = DEFAULT_GROUP_ID,
        ledger_path: Path = LEDGER_PATH,
        ingest_log_path: Path = INGEST_LOG_PATH,
        lag_snapshot_path: Path = LAG_SNAPSHOT_PATH,
        poll_timeout_ms: int = 1000,
        max_poll_records: int = 256,
    ) -> None:
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.dlq_topic = dlq_topic
        self.group_id = group_id
        self.poll_timeout_ms = poll_timeout_ms
        self.max_poll_records = max_poll_records
        self.ledger = DedupLedger(ledger_path)
        self.ingest_log_path = ingest_log_path
        self.ingest_log_path.parent.mkdir(parents=True, exist_ok=True)
        self.lag_snapshot_path = lag_snapshot_path
        self.lag_snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        self.counters = Counters()
        self._consumer: KafkaConsumer | None = None
        self._producer: KafkaProducer | None = None
        self._running = False

    # ── connection ────────────────────────────────────────────────────────
    def _connect(self) -> None:
        try:
            self._consumer = KafkaConsumer(
                self.topic,
                bootstrap_servers=self.bootstrap_servers,
                group_id=self.group_id,
                enable_auto_commit=False,
                auto_offset_reset="earliest",
                max_poll_records=self.max_poll_records,
                value_deserializer=lambda v: v,  # keep raw bytes; we parse manually
                consumer_timeout_ms=0,
            )
            self._producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
                acks="all",
                retries=3,
                linger_ms=20,
            )
        except NoBrokersAvailable as exc:
            raise SystemExit(
                f"Kafka broker not reachable at {self.bootstrap_servers}. "
                "Run `make up-deps` first."
            ) from exc

    # ── core loop ─────────────────────────────────────────────────────────
    def run(self) -> None:
        self._connect()
        assert self._consumer and self._producer
        self._install_signal_handlers()
        self._running = True
        self._snapshot_health()  # initial snapshot so /streaming/health is non-empty

        logger.info(
            "Kafka consumer ready (bootstrap=%s, topic=%s, dlq=%s, group=%s)",
            self.bootstrap_servers,
            self.topic,
            self.dlq_topic,
            self.group_id,
        )

        try:
            while self._running:
                batches = self._consumer.poll(timeout_ms=self.poll_timeout_ms)
                if not batches:
                    self._snapshot_health()
                    continue

                for tp, records in batches.items():
                    for record in records:
                        self.counters.polled += 1
                        self._process_one(tp, record)

                # Manual commit: only after the whole poll-batch is ledgered.
                try:
                    self._consumer.commit()
                except KafkaError as exc:
                    logger.warning("Commit failed; will retry on next poll: %s", exc)

                self._snapshot_health()
        finally:
            self._shutdown()

    # ── per-record handling ───────────────────────────────────────────────
    def _process_one(self, tp: TopicPartition, record: Any) -> None:
        # 1. Parse
        try:
            payload = json.loads(record.value.decode("utf-8") if record.value else "null")
            if not isinstance(payload, dict):
                raise ValueError("Kafka record payload must be a JSON object")
        except Exception as exc:  # noqa: BLE001
            self.counters.parse_errors += 1
            self._publish_dlq(record, payload=record.value, error=exc, reason="parse_error")
            return

        # 2. Required keys (event_id is mandatory; x_trace_id and requirement_id optional).
        event_id = payload.get("event_id") or payload.get("sample_id")
        if not event_id:
            self.counters.parse_errors += 1
            self._publish_dlq(
                record, payload=payload, error=ValueError("missing event_id"), reason="missing_id"
            )
            return

        x_trace_id = payload.get("x_trace_id")
        requirement_id = payload.get("requirement_id")
        event_id = str(event_id)

        # 3. Dedup against ledger
        if self.ledger.seen(event_id, x_trace_id):
            self.counters.duplicates += 1
            return

        # 4. Side-effect: append to ingest JSONL (the local-first workflow consumes this).
        try:
            self._append_ingest(payload)
        except Exception as exc:  # noqa: BLE001
            self.counters.process_errors += 1
            self._publish_dlq(record, payload=payload, error=exc, reason="ingest_write_failed")
            return

        # 5. Remember in ledger AFTER the side-effect succeeded.
        self.ledger.remember(
            event_id=event_id,
            x_trace_id=x_trace_id,
            requirement_id=requirement_id,
            topic=tp.topic,
            partition=tp.partition,
            offset=record.offset,
        )
        self.counters.accepted += 1
        self.counters.last_event_at = datetime.now(UTC).isoformat()
        self.counters.last_x_trace_id = x_trace_id

    def _append_ingest(self, payload: dict[str, Any]) -> None:
        # Tag the event with a kafka-ingest timestamp so downstream batches can
        # tell file-mode events apart from kafka-mode events.
        enriched = dict(payload)
        enriched.setdefault("kafka_ingested_at", datetime.now(UTC).isoformat())
        with self.ingest_log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(enriched, ensure_ascii=False) + "\n")

    # ── DLQ ───────────────────────────────────────────────────────────────
    def _publish_dlq(
        self,
        record: Any,
        *,
        payload: Any,
        error: Exception,
        reason: str,
    ) -> None:
        if self._producer is None:
            return
        envelope = {
            "reason": reason,
            "error_class": type(error).__name__,
            "error_message": str(error),
            "original_topic": record.topic,
            "original_partition": record.partition,
            "original_offset": record.offset,
            "kafka_timestamp": getattr(record, "timestamp", None),
            "received_at": datetime.now(UTC).isoformat(),
            "payload": payload if isinstance(payload, (dict, list, str, int, float, bool, type(None))) else repr(payload),
        }
        try:
            self._producer.send(self.dlq_topic, value=envelope)
            self._producer.flush(timeout=5)
            self.counters.dlq += 1
        except KafkaError as exc:
            logger.error("Failed to publish to DLQ %s: %s", self.dlq_topic, exc)

    # ── lag + health snapshot ─────────────────────────────────────────────
    def _snapshot_health(self) -> None:
        if self._consumer is None:
            return
        partition_lag: list[PartitionLag] = []
        try:
            assignment = self._consumer.assignment()
            if assignment:
                end_offsets = self._consumer.end_offsets(list(assignment))
                for tp in assignment:
                    pos = self._consumer.position(tp)
                    end = end_offsets.get(tp, pos)
                    partition_lag.append(
                        PartitionLag(
                            topic=tp.topic,
                            partition=tp.partition,
                            current_offset=int(pos),
                            end_offset=int(end),
                            lag=max(0, int(end) - int(pos)),
                        )
                    )
        except KafkaError as exc:
            logger.debug("Lag snapshot skipped: %s", exc)

        snapshot = HealthSnapshot(
            bootstrap_servers=self.bootstrap_servers,
            topic=self.topic,
            dlq_topic=self.dlq_topic,
            group_id=self.group_id,
            counters=self.counters,
            partition_lag=partition_lag,
            snapshot_at=datetime.now(UTC).isoformat(),
        )

        try:
            tmp = self.lag_snapshot_path.with_suffix(self.lag_snapshot_path.suffix + ".tmp")
            tmp.write_text(json.dumps(snapshot.to_dict(), ensure_ascii=False, indent=2))
            tmp.replace(self.lag_snapshot_path)
        except OSError as exc:
            logger.warning("Failed to write lag snapshot: %s", exc)

    # ── lifecycle ─────────────────────────────────────────────────────────
    def _install_signal_handlers(self) -> None:
        def _handler(signum, _frame):
            logger.info("Received signal %s, draining…", signum)
            self._running = False

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                signal.signal(sig, _handler)
            except (ValueError, OSError):
                # signal.signal can fail outside the main thread (e.g. dagster ops)
                pass

    def _shutdown(self) -> None:
        try:
            if self._consumer is not None:
                try:
                    self._consumer.commit()
                except KafkaError:
                    pass
                self._consumer.close()
        finally:
            if self._producer is not None:
                try:
                    self._producer.flush(timeout=5)
                except KafkaError:
                    pass
                self._producer.close()
            self.ledger.close()
            logger.info(
                "Kafka consumer stopped. polled=%d accepted=%d duplicates=%d dlq=%d",
                self.counters.polled,
                self.counters.accepted,
                self.counters.duplicates,
                self.counters.dlq,
            )


def run_consumer() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    KafkaStreamingTrigger().run()


if __name__ == "__main__":
    try:
        run_consumer()
    except KeyboardInterrupt:
        sys.exit(0)
