import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

from core.domain.models import LineageEvent


class SQLiteMetadataAdapter:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_schema(self) -> None:
        connection = self._connect()
        connection.executescript(
            '''
            create table if not exists workspaces (
                workspace_id text primary key,
                name text not null
            );
            create table if not exists datasets (
                dataset_id text primary key,
                name text not null,
                workspace_id text not null,
                profile text not null
            );
            create table if not exists dataset_versions (
                version_id text primary key,
                dataset_id text not null,
                sample_count integer not null,
                table_name text not null default 'dataset_samples'
            );
            create table if not exists job_runs (
                run_id text primary key,
                job_name text not null,
                status text not null
            );
            create table if not exists tasks (
                task_id text primary key,
                title text not null,
                status text not null,
                task_type text not null
            );
            create table if not exists export_jobs (
                export_id text primary key,
                dataset_id text not null,
                format text not null,
                status text not null,
                output_path text not null
            );
            create table if not exists lineage_events (
                event_id integer primary key autoincrement,
                event_type text not null,
                subject_id text not null,
                payload text not null
            );
            '''
        )
        self._ensure_column(connection, 'job_runs', 'requirement_id', 'text')
        self._ensure_column(connection, 'job_runs', 'operation_task_id', 'text')
        self._ensure_column(connection, 'job_runs', 'trigger_source', 'text')
        self._ensure_column(connection, 'job_runs', 'reason_code', 'text')
        self._ensure_column(connection, 'job_runs', 'duration_seconds', 'real')
        self._ensure_column(connection, 'job_runs', 'cpu_seconds', 'real')
        self._ensure_column(connection, 'job_runs', 'gpu_seconds', 'real')
        self._ensure_column(connection, 'job_runs', 'input_bytes', 'integer')
        self._ensure_column(connection, 'job_runs', 'output_bytes', 'integer')
        self._ensure_column(connection, 'job_runs', 'estimated_cost', 'real')
        self._ensure_column(connection, 'job_runs', 'derived_assets_json', 'text')
        self._ensure_column(connection, 'job_runs', 'created_at', 'text')

        self._ensure_column(connection, 'tasks', 'requirement_id', 'text')
        self._ensure_column(connection, 'tasks', 'pipeline_run_id', 'text')
        self._ensure_column(connection, 'tasks', 'assignee', 'text')
        self._ensure_column(connection, 'tasks', 'created_at', 'text')
        self._ensure_column(connection, 'tasks', 'updated_at', 'text')
        connection.commit()
        connection.close()

    def _ensure_column(self, connection: sqlite3.Connection, table_name: str, column_name: str, column_type: str) -> None:
        rows = connection.execute(f'pragma table_info({table_name})').fetchall()
        existing = {row['name'] for row in rows}
        if column_name in existing:
            return
        connection.execute(
            f'alter table {table_name} add column {column_name} {column_type}'
        )

    def create_workspace(self, payload: dict) -> dict:
        connection = self._connect()
        connection.execute(
            'insert or replace into workspaces (workspace_id, name) values (?, ?)',
            (payload['workspace_id'], payload['name']),
        )
        connection.commit()
        connection.close()
        return payload

    def list_workspaces(self) -> list[dict]:
        connection = self._connect()
        rows = connection.execute('select workspace_id, name from workspaces order by workspace_id').fetchall()
        connection.close()
        return [dict(row) for row in rows]

    def create_dataset(self, payload: dict) -> dict:
        connection = self._connect()
        connection.execute(
            'insert or replace into datasets (dataset_id, name, workspace_id, profile) values (?, ?, ?, ?)',
            (payload['dataset_id'], payload['name'], payload['workspace_id'], payload['profile']),
        )
        connection.commit()
        connection.close()
        return payload

    def list_datasets(self) -> list[dict]:
        connection = self._connect()
        rows = connection.execute('select dataset_id, name, workspace_id, profile from datasets order by dataset_id').fetchall()
        connection.close()
        return [dict(row) for row in rows]

    def get_dataset(self, dataset_id: str) -> dict | None:
        connection = self._connect()
        row = connection.execute(
            'select dataset_id, name, workspace_id, profile from datasets where dataset_id = ?',
            (dataset_id,),
        ).fetchone()
        connection.close()
        return dict(row) if row else None

    def create_dataset_version(self, payload: dict) -> dict:
        connection = self._connect()
        connection.execute(
            'insert or replace into dataset_versions (version_id, dataset_id, sample_count, table_name) values (?, ?, ?, ?)',
            (payload['version_id'], payload['dataset_id'], payload['sample_count'], payload.get('table_name', 'dataset_samples')),
        )
        connection.commit()
        connection.close()
        return payload

    def list_dataset_versions(self, dataset_id: str) -> list[dict]:
        connection = self._connect()
        rows = connection.execute(
            'select version_id, dataset_id, sample_count, table_name from dataset_versions where dataset_id = ? order by version_id',
            (dataset_id,),
        ).fetchall()
        connection.close()
        return [dict(row) for row in rows]

    def create_job_run(self, payload: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        created_at = payload.get('created_at') or now
        derived_assets_json = json.dumps(payload.get('derived_assets', []))
        connection = self._connect()
        connection.execute(
            (
                'insert or replace into job_runs '
                '(run_id, job_name, status, requirement_id, operation_task_id, trigger_source, reason_code, '
                'duration_seconds, cpu_seconds, gpu_seconds, input_bytes, output_bytes, estimated_cost, '
                'derived_assets_json, created_at) '
                'values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ),
            (
                payload['run_id'],
                payload['job_name'],
                payload['status'],
                payload.get('requirement_id'),
                payload.get('operation_task_id'),
                payload.get('trigger_source'),
                payload.get('reason_code'),
                payload.get('duration_seconds'),
                payload.get('cpu_seconds'),
                payload.get('gpu_seconds'),
                payload.get('input_bytes'),
                payload.get('output_bytes'),
                payload.get('estimated_cost'),
                derived_assets_json,
                created_at,
            ),
        )
        connection.commit()
        connection.close()
        return {
            **payload,
            'created_at': created_at,
            'derived_assets': payload.get('derived_assets', []),
        }

    def list_job_runs(self) -> list[dict]:
        connection = self._connect()
        rows = connection.execute(
            (
                'select run_id, job_name, status, requirement_id, operation_task_id, trigger_source, reason_code, '
                'duration_seconds, cpu_seconds, gpu_seconds, input_bytes, output_bytes, estimated_cost, '
                'derived_assets_json, created_at '
                'from job_runs order by run_id desc'
            )
        ).fetchall()
        connection.close()
        items: list[dict] = []
        for row in rows:
            item = dict(row)
            item['derived_assets'] = json.loads(item.get('derived_assets_json') or '[]')
            item.pop('derived_assets_json', None)
            items.append(item)
        return items

    def create_task(self, payload: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        created_at = payload.get('created_at') or now
        updated_at = payload.get('updated_at') or now
        connection = self._connect()
        connection.execute(
            (
                'insert or replace into tasks '
                '(task_id, title, status, task_type, requirement_id, pipeline_run_id, assignee, created_at, updated_at) '
                'values (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ),
            (
                payload['task_id'],
                payload['title'],
                payload['status'],
                payload['task_type'],
                payload.get('requirement_id'),
                payload.get('pipeline_run_id'),
                payload.get('assignee'),
                created_at,
                updated_at,
            ),
        )
        connection.commit()
        connection.close()
        return {
            **payload,
            'created_at': created_at,
            'updated_at': updated_at,
        }

    def list_tasks(self) -> list[dict]:
        connection = self._connect()
        rows = connection.execute(
            (
                'select task_id, title, status, task_type, requirement_id, pipeline_run_id, assignee, created_at, updated_at '
                'from tasks order by task_id'
            )
        ).fetchall()
        connection.close()
        return [dict(row) for row in rows]

    def create_export_job(self, payload: dict) -> dict:
        connection = self._connect()
        connection.execute(
            'insert or replace into export_jobs (export_id, dataset_id, format, status, output_path) values (?, ?, ?, ?, ?)',
            (payload['export_id'], payload['dataset_id'], payload['format'], payload['status'], payload['output_path']),
        )
        connection.commit()
        connection.close()
        return payload

    def list_export_jobs(self) -> list[dict]:
        connection = self._connect()
        rows = connection.execute(
            'select export_id, dataset_id, format, status, output_path from export_jobs order by export_id'
        ).fetchall()
        connection.close()
        return [dict(row) for row in rows]

    def append_lineage_event(self, payload: LineageEvent) -> dict:
        event = payload.model_dump()
        connection = self._connect()
        connection.execute(
            'insert into lineage_events (event_type, subject_id, payload) values (?, ?, ?)',
            (event['event_type'], event['subject_id'], json.dumps(event['payload'])),
        )
        connection.commit()
        connection.close()
        return event
