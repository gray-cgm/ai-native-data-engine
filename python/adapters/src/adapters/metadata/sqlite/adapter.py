import json
import sqlite3
from pathlib import Path

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
        connection.commit()
        connection.close()

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
        connection = self._connect()
        connection.execute(
            'insert or replace into job_runs (run_id, job_name, status) values (?, ?, ?)',
            (payload['run_id'], payload['job_name'], payload['status']),
        )
        connection.commit()
        connection.close()
        return payload

    def list_job_runs(self) -> list[dict]:
        connection = self._connect()
        rows = connection.execute('select run_id, job_name, status from job_runs order by run_id').fetchall()
        connection.close()
        return [dict(row) for row in rows]

    def create_task(self, payload: dict) -> dict:
        connection = self._connect()
        connection.execute(
            'insert or replace into tasks (task_id, title, status, task_type) values (?, ?, ?, ?)',
            (payload['task_id'], payload['title'], payload['status'], payload['task_type']),
        )
        connection.commit()
        connection.close()
        return payload

    def list_tasks(self) -> list[dict]:
        connection = self._connect()
        rows = connection.execute('select task_id, title, status, task_type from tasks order by task_id').fetchall()
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
