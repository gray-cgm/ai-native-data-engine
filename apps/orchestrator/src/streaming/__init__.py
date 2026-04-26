"""Kafka-driven streaming entrypoints for the orchestrator.

This package bridges the local micro-batch streaming workflow
(`workflows.streaming.local_demo`) to a real Kafka source so that the
streaming pipeline becomes observable in the same way batch is observable
through Dagster — operators see live ingest, lag, and DLQ activity in
``Pipelines → Overview`` and the embedded ``kafka-ui`` console.
"""

from .kafka_trigger import KafkaStreamingTrigger, run_consumer

__all__ = ["KafkaStreamingTrigger", "run_consumer"]
