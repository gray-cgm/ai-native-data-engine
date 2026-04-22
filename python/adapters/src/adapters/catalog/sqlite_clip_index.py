"""SQLite-backed clip catalog index.

Backs the clip-centric REST routes (``/clips``, ``/clips/{id}``, plus the
scenario/dataset aggregates) with a cached, filterable, paginated view so we
do not rescan every Lance file on each request.

Design
------
* One row per clip in ``clips`` holding the columns used for filtering /
  ordering plus two JSON blobs: the API-shaped ``summary_json`` and the raw
  ``meta_json``. Tag membership is fanned out to ``clip_tags`` for fast
  equality lookup.
* Freshness: per-clip mtime tracked in ``source_mtime_ns``. On every read we
  compare the clip directory mtime against the stored one and lazily rebuild
  that clip's row. ``refresh(full=True)`` also drops rows for clips that are
  no longer on disk.
* Thread-safety: writes serialised via an in-process lock; reads use
  short-lived connections (SQLite WAL).

The index is a *derived artefact*; deleting the sqlite file forces a full
rebuild on next access. It lives under ``data/metadata/clip_catalog.sqlite``
by convention.
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Iterable

from adapters import clip_reader
from core.domain.models import (
    ClipCatalogPage,
    ClipCatalogQuery,
    ClipSummary,
    DatasetSummary,
    ScenarioSummary,
)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS clips (
  clip_id TEXT PRIMARY KEY,
  scenario TEXT,
  vehicle_name TEXT,
  vehicle_model TEXT,
  city TEXT,
  district TEXT,
  start_time INTEGER,
  end_time INTEGER,
  duration_seconds REAL,
  keyframe_count INTEGER NOT NULL DEFAULT 0,
  topic_count INTEGER NOT NULL DEFAULT 0,
  camera_count INTEGER NOT NULL DEFAULT 0,
  standalone_topic_count INTEGER NOT NULL DEFAULT 0,
  has_wm INTEGER NOT NULL DEFAULT 0,
  tags_csv TEXT NOT NULL DEFAULT '',
  da_tags_csv TEXT NOT NULL DEFAULT '',
  summary_json TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  source_mtime_ns INTEGER NOT NULL,
  indexed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_clips_scenario ON clips(scenario);
CREATE INDEX IF NOT EXISTS ix_clips_vehicle  ON clips(vehicle_name);
CREATE INDEX IF NOT EXISTS ix_clips_city     ON clips(city);
CREATE INDEX IF NOT EXISTS ix_clips_start    ON clips(start_time DESC);

CREATE TABLE IF NOT EXISTS clip_tags (
  clip_id TEXT NOT NULL,
  kind    TEXT NOT NULL,   -- 'tag' | 'da_tag'
  value   TEXT NOT NULL,
  PRIMARY KEY (clip_id, kind, value)
);
CREATE INDEX IF NOT EXISTS ix_clip_tags_value ON clip_tags(kind, value);
"""


# ── helpers ──────────────────────────────────────────────────────────────────

def _clip_source_mtime_ns(clip_dir: Path) -> int:
    """Return max mtime across the clip dir + its known top-level tables.

    Using the max catches partial updates where e.g. ``meta.lance`` was
    rewritten but the parent dir mtime is unchanged.
    """

    candidates = [clip_dir]
    for name in ('meta.lance', 'topic.lance', 'wm.lance'):
        p = clip_dir / name
        if p.exists():
            candidates.append(p)
    return max(p.stat().st_mtime_ns for p in candidates)


def _split_csv(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if v is not None and str(v).strip()]
    if isinstance(value, str):
        return [s.strip() for s in value.split(',') if s.strip()]
    return []


def _json_safe(value: Any) -> Any:
    """Coerce values returned by ``lance`` into json.dumps-friendly shapes."""

    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode('utf-8')
        except UnicodeDecodeError:
            return value.hex()
    return value


# ── index ────────────────────────────────────────────────────────────────────

@dataclass
class ClipCatalogIndex:
    """SQLite-backed catalog index."""

    db_path: Path
    lance_root: Path

    def __post_init__(self) -> None:
        self._write_lock = Lock()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    # -- connection ---------------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        return conn

    # -- (re)build ----------------------------------------------------------

    def refresh(self, *, full: bool = False) -> dict[str, int]:
        """Bring the index in sync with the Lance root.

        Only clips whose on-disk mtime changed are rescanned. Pass
        ``full=True`` to also drop rows for clips that no longer exist.
        """

        if not self.lance_root.exists():
            return {'added': 0, 'updated': 0, 'removed': 0, 'total': 0}
        clip_ids = clip_reader.list_clip_ids(self.lance_root)
        added = updated = removed = 0
        with self._write_lock, self._connect() as conn:
            existing = {
                row['clip_id']: row['source_mtime_ns']
                for row in conn.execute('SELECT clip_id, source_mtime_ns FROM clips')
            }
            for cid in clip_ids:
                clip_dir = self.lance_root / cid
                mtime = _clip_source_mtime_ns(clip_dir)
                if existing.get(cid) == mtime:
                    continue
                self._upsert_clip(conn, clip_dir, mtime)
                if cid in existing:
                    updated += 1
                else:
                    added += 1
            if full:
                stale = set(existing) - set(clip_ids)
                for cid in stale:
                    conn.execute('DELETE FROM clips WHERE clip_id = ?', (cid,))
                    conn.execute('DELETE FROM clip_tags WHERE clip_id = ?', (cid,))
                    removed += 1
            conn.commit()
        return {
            'added': added,
            'updated': updated,
            'removed': removed,
            'total': len(clip_ids),
        }

    def _upsert_clip(self, conn: sqlite3.Connection, clip_dir: Path, mtime: int) -> None:
        summary = clip_reader.load_summary(clip_dir)
        meta = clip_reader.load_meta(clip_dir)
        duration = (
            (summary.end_time - summary.start_time) / 1e9
            if summary.start_time and summary.end_time
            else None
        )
        tag_list = _split_csv(summary.tags)
        da_tag_list = _split_csv(summary.da_tags)
        # DTO stored as-emitted so the API layer can serve it verbatim.
        summary_payload = {
            'clip_id': summary.clip_id,
            'keyframe_count': summary.keyframe_count,
            'start_time': summary.start_time,
            'end_time': summary.end_time,
            'duration_seconds': duration,
            'vehicle_name': summary.vehicle_name,
            'city': summary.city,
            'district': summary.district,
            'scenario': summary.scenario,
            'tags': summary.tags,
            'da_tags': summary.da_tags,
            'topics': [
                {'name': t.name, 'non_null_count': t.non_null_count}
                for t in summary.schema.topics
            ],
            'cameras': [
                {'name': c.name, 'frame_count': c.frame_count}
                for c in summary.schema.cameras
            ],
            'standalone_topics': [
                {'name': t.name, 'row_count': t.row_count}
                for t in summary.schema.standalone_topics
            ],
            'has_wm': summary.schema.has_wm,
        }
        conn.execute('DELETE FROM clips     WHERE clip_id = ?', (summary.clip_id,))
        conn.execute('DELETE FROM clip_tags WHERE clip_id = ?', (summary.clip_id,))
        conn.execute(
            """
            INSERT INTO clips (
              clip_id, scenario, vehicle_name, vehicle_model, city, district,
              start_time, end_time, duration_seconds, keyframe_count,
              topic_count, camera_count, standalone_topic_count, has_wm,
              tags_csv, da_tags_csv, summary_json, meta_json,
              source_mtime_ns, indexed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                summary.clip_id,
                summary.scenario,
                summary.vehicle_name,
                meta.get('vehicle_model'),
                summary.city,
                summary.district,
                summary.start_time,
                summary.end_time,
                duration,
                summary.keyframe_count,
                len(summary.schema.topics),
                len(summary.schema.cameras),
                len(summary.schema.standalone_topics),
                1 if summary.schema.has_wm else 0,
                summary.tags or '',
                summary.da_tags or '',
                json.dumps(summary_payload, ensure_ascii=False),
                json.dumps(_json_safe(meta), ensure_ascii=False),
                mtime,
                int(time.time() * 1000),
            ),
        )
        tag_rows = [(summary.clip_id, 'tag', t) for t in tag_list]
        tag_rows.extend((summary.clip_id, 'da_tag', t) for t in da_tag_list)
        if tag_rows:
            conn.executemany(
                'INSERT OR IGNORE INTO clip_tags (clip_id, kind, value) VALUES (?, ?, ?)',
                tag_rows,
            )

    # -- reads --------------------------------------------------------------

    def query(self, q: ClipCatalogQuery) -> ClipCatalogPage:
        self.refresh()
        where, params = self._where(q)
        order = self._order(q.sort)
        limit = max(1, min(q.limit, 500))
        offset = max(0, q.offset)
        with self._connect() as conn:
            total = conn.execute(
                f'SELECT COUNT(*) FROM clips WHERE {where}', params,
            ).fetchone()[0]
            rows = conn.execute(
                f'SELECT summary_json FROM clips WHERE {where} '
                f'ORDER BY {order} LIMIT ? OFFSET ?',
                (*params, limit, offset),
            ).fetchall()
        items = [ClipSummary.model_validate(json.loads(r['summary_json'])) for r in rows]
        return ClipCatalogPage(items=items, total=total, limit=limit, offset=offset)

    def get(self, clip_id: str) -> tuple[ClipSummary, dict[str, Any]] | None:
        self.refresh()
        with self._connect() as conn:
            row = conn.execute(
                'SELECT summary_json, meta_json FROM clips WHERE clip_id = ?',
                (clip_id,),
            ).fetchone()
        if not row:
            return None
        summary = ClipSummary.model_validate(json.loads(row['summary_json']))
        meta = json.loads(row['meta_json'])
        return summary, meta

    def get_many(self, clip_ids: Iterable[str]) -> list[ClipSummary]:
        ids = list(clip_ids)
        if not ids:
            return []
        self.refresh()
        placeholders = ','.join('?' for _ in ids)
        with self._connect() as conn:
            rows = conn.execute(
                f'SELECT clip_id, summary_json FROM clips '
                f'WHERE clip_id IN ({placeholders})',
                ids,
            ).fetchall()
        by_id = {r['clip_id']: json.loads(r['summary_json']) for r in rows}
        return [ClipSummary.model_validate(by_id[c]) for c in ids if c in by_id]

    # -- aggregates ---------------------------------------------------------

    def scenarios(self) -> list[ScenarioSummary]:
        self.refresh()
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT COALESCE(NULLIF(scenario, ''), '') AS scenario_key,
                       COUNT(*)                          AS clip_count,
                       COALESCE(SUM(keyframe_count), 0)  AS keyframe_count,
                       COALESCE(SUM(duration_seconds), 0.0) AS duration_seconds,
                       MIN(start_time)                   AS first_start_time,
                       MAX(end_time)                     AS last_end_time
                FROM clips
                GROUP BY scenario_key
                ORDER BY clip_count DESC, scenario_key ASC
                """,
            ).fetchall()
        out: list[ScenarioSummary] = []
        for r in rows:
            name = r['scenario_key'] or 'unassigned'
            out.append(
                ScenarioSummary(
                    scenario_id=f'scenario:{name}',
                    scenario_name=name,
                    clip_count=int(r['clip_count']),
                    keyframe_count=int(r['keyframe_count'] or 0),
                    duration_seconds=float(r['duration_seconds'] or 0.0),
                    first_start_time=r['first_start_time'],
                    last_end_time=r['last_end_time'],
                )
            )
        return out

    def datasets(self) -> list[DatasetSummary]:
        """Return scenario-grouped virtual datasets for Catalog.

        This mirrors the front-end ``buildClipDatasets`` logic but is served
        server-side so the UI can paginate / drill-down without pulling the
        full clip list.
        """

        return [
            DatasetSummary(
                dataset_id=s.scenario_id,
                name=s.scenario_name,
                scenario=None if s.scenario_name == 'unassigned' else s.scenario_name,
                clip_count=s.clip_count,
                keyframe_count=s.keyframe_count,
                duration_seconds=s.duration_seconds,
            )
            for s in self.scenarios()
        ]

    # -- filtering / ordering ----------------------------------------------

    @staticmethod
    def _order(sort: str) -> str:
        return {
            'start_time_desc': 'COALESCE(start_time, 0) DESC, clip_id ASC',
            'start_time_asc':  'COALESCE(start_time, 0) ASC,  clip_id ASC',
            'clip_id_asc':     'clip_id ASC',
            'duration_desc':   'COALESCE(duration_seconds, 0) DESC, clip_id ASC',
        }.get(sort, 'COALESCE(start_time, 0) DESC, clip_id ASC')

    def _where(self, q: ClipCatalogQuery) -> tuple[str, list[Any]]:
        clauses: list[str] = ['1=1']
        params: list[Any] = []
        if q.scenario is not None:
            if q.scenario in ('', 'unassigned'):
                clauses.append("(scenario IS NULL OR scenario = '')")
            else:
                clauses.append('scenario = ?')
                params.append(q.scenario)
        if q.vehicle_name:
            clauses.append('vehicle_name = ?')
            params.append(q.vehicle_name)
        if q.city:
            clauses.append('city = ?')
            params.append(q.city)
        if q.district:
            clauses.append('district = ?')
            params.append(q.district)
        if q.has_wm is not None:
            clauses.append('has_wm = ?')
            params.append(1 if q.has_wm else 0)
        if q.start_after is not None:
            clauses.append('start_time >= ?')
            params.append(q.start_after)
        if q.start_before is not None:
            clauses.append('start_time <= ?')
            params.append(q.start_before)
        if q.clip_ids:
            placeholders = ','.join('?' for _ in q.clip_ids)
            clauses.append(f'clip_id IN ({placeholders})')
            params.extend(q.clip_ids)
        for tag in q.tags:
            clauses.append(
                "clip_id IN (SELECT clip_id FROM clip_tags "
                "WHERE kind='tag' AND value = ?)"
            )
            params.append(tag)
        for tag in q.da_tags:
            clauses.append(
                "clip_id IN (SELECT clip_id FROM clip_tags "
                "WHERE kind='da_tag' AND value = ?)"
            )
            params.append(tag)
        if q.keyword:
            kw = f'%{q.keyword.lower()}%'
            clauses.append(
                "("
                "LOWER(clip_id) LIKE ? OR "
                "LOWER(COALESCE(vehicle_name,'')) LIKE ? OR "
                "LOWER(COALESCE(city,'')) LIKE ? OR "
                "LOWER(COALESCE(district,'')) LIKE ? OR "
                "LOWER(COALESCE(scenario,'')) LIKE ? OR "
                "LOWER(tags_csv) LIKE ? OR "
                "LOWER(da_tags_csv) LIKE ?"
                ")"
            )
            params.extend([kw] * 7)
        return ' AND '.join(clauses), params
