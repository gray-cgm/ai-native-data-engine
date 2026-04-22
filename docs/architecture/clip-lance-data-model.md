# Clip-centric Lance Data Model

This document specifies the on-disk layout and logical schema of the clip-level
Lance datasets that the AI Data Loop Engine ingests, queries and visualizes.
The design is derived from the real example under
`data/lance/c-0b7cf8d7-9c33-3aae-873c-4e9847eb10b8/` and is the single source of
truth for `make ingest`, `make query`, `make lance`, `make stream-demo` and the
Web Explorer clip pages.

## 1. Top-level layout

A **clip** is a self-contained directory whose name matches the pattern
`c-<uuid>` and which groups all data recorded by one vehicle during one drive
segment:

```
data/lance/
  c-<uuid>/                        # one clip
    meta.lance/                    # 1 row — clip-level metadata
    topic.lance/                   # N rows — aligned multi-topic table
    wm.lance/                      # N rows — world-model matrix per keyframe
    <TopicName>.lance/             # standalone high-rate topic tables
    <TopicName>.lance/
    ...
```

All tables inside a clip share the clip id as primary key in the filesystem,
and the `timestamp` column (`int64`, epoch nanoseconds) as their time key.
`topic.lance.timestamp` is the clip's canonical keyframe clock — every other
Lance table is joinable to it by nearest-timestamp.

```
clip (c-UUID)
├── meta.lance          (1 row — calibration, vehicle, tags, mp4 URIs, …)
├── topic.lance         (K keyframes — aligned topic+camera index columns)
├── wm.lance            (K keyframes — BEV world-model byte blob)
└── <Topic>.lance × M   (raw topic stream at native rate)
```

## 2. Tables

### 2.1 `meta.lance` — clip metadata (1 row)

| Column                | Type                              | Description                                                                 |
|-----------------------|-----------------------------------|-----------------------------------------------------------------------------|
| `calibration_info`    | `string` (JSON)                   | Full sensor rig calibration: per-camera `intrinsic`, `extrinsic`, `properties`. |
| `start_time`          | `int64` (ns)                      | Clip start epoch.                                                           |
| `end_time`            | `int64` (ns)                      | Clip end epoch.                                                             |
| `vehicle_name`        | `string`                          | e.g. `L1NNSGMA6SB132502rev7`.                                              |
| `city`                | `string`                          | e.g. `wuhan`.                                                               |
| `district`            | `string`                          | e.g. `hanyangqu`.                                                           |
| `vehicle_model`       | `int32`                           | Vehicle model enum.                                                         |
| `vehicle_info`        | `map<string, double>`             | Body dimensions in mm: `length, width, front_edge_to_center, …`.            |
| `scenario`            | `string`                          | Producing pipeline, e.g. `xminer-pipeline-video`.                           |
| `calibration_version` | `int32`                           | Calibration revision.                                                       |
| `tags`                | `string`                          | Freeform processing tags (`masked,maskModelDesensitizer…`).                |
| `da_tags`             | `string`                          | Data-annotation tags (`goodCase_gt`).                                       |
| `jira_id`             | `string` (nullable)               | Linked issue.                                                               |
| `mp4_resize_path`     | `map<string, list<string>>`       | Downscaled MP4 variants per camera; list order = quality ladder.            |
| `mp4_path`            | `map<string, string>`             | Original per-camera MP4 URI, typically `oss://…`.                           |

Notes:
- `calibration_info` is a blob JSON; parsers should treat missing camera keys as
  optional. The set of keys discovered in the reference clip is:
  `cam0 cam2 cam3 cam4 cam5 cam6 cam7 cam9 cam10 cam11 cam12 map_bev
  lidar_repack lidar_repack2 avm_bev`.
- `vehicle_info` keys are stable: `length, width, front_edge_to_center,
  back_edge_to_center, left_edge_to_center, right_edge_to_center`.
- `mp4_path` values are **remote OSS URIs**; local playback uses a cached
  copy under `data/raw/thumbnail_video/<clip_id>/<cam>.mp4` (see §5). The
  cache is populated from `mp4_resize_path` (preferred, lowest-resolution
  variant) or from `mp4_path` as a fallback.

### 2.2 `topic.lance` — aligned keyframe table (K rows)

```
timestamp: int64                                   # keyframe clock
<TopicName>: struct<timestamp: int64, data: large_string>   # aligned topic payload
<camN>:      struct<video_frame_timestamp: int64, video_frame_index: int32>
```

The reference clip carries 8 topic struct columns and 7 camera index columns:

| Group  | Columns                                                                                                            |
|--------|--------------------------------------------------------------------------------------------------------------------|
| Topics | `LocalPoseTopic` `MfLocalPoseTopic` `OnlineLocalMapTopic` `SDNavigationTopic` `SensorFusionTopic` `RealtimeMapTopic` `XplannerDataBackfillTopic` `CleanV2PathTopic` |
| Cameras| `cam0` `cam2` `cam3` `cam4` `cam5` `cam6` `cam7`                                                                   |

Semantics:
- Each topic struct holds `{timestamp, data}` where `data` is the raw JSON
  payload (pose, lane lines, fusion tracks, etc.). When a topic has no
  corresponding message at a keyframe the whole struct is `NULL` (not an empty
  struct).
- Each camera struct holds `{video_frame_timestamp, video_frame_index}` — an
  index into the decoded MP4 identified by `meta.mp4_path[camN]`. At most one
  camera's `video_frame_timestamp` equals `timestamp` for any given keyframe.
- The set of columns is clip-dependent; readers **must** introspect the schema
  rather than assume any specific topic/camera exists.

### 2.3 `wm.lance` — world-model BEV blob (K rows, same clock as `topic.lance`)

| Column                   | Type      | Description                                     |
|--------------------------|-----------|-------------------------------------------------|
| `timestamp`              | `int64`   | Same keyframe clock as `topic.lance`.           |
| `WM_BEV_MATRLZ`          | `binary`  | Serialized world-model BEV tensor.              |
| `WM_BEV_MATRLZ_STATUS`   | `int32`   | Status/enum for the blob validity.              |

### 2.4 `<TopicName>.lance` — standalone high-rate topics

For topics whose native rate exceeds the keyframe rate, the producer writes an
additional **standalone table** with two columns:

```
timestamp: int64
data:      large_string          # raw JSON payload at native rate
```

In the reference clip, the standalone tables observed are:

| Table                               | Row count | Notes                              |
|-------------------------------------|-----------|------------------------------------|
| `LocalPoseTopic.lance`              | 3050      | Native-rate pose stream.           |
| `MfLocalPoseTopic.lance`            | 3050      | Multi-fused pose stream.           |
| `CleanV2PathTopic.lance`            | 367       | Same rate as keyframe in this clip.|
| `CleanV2PathWithVirtualTopic.lance` | 367       | Present only as standalone.        |

Joinability rules:
- If a `<Topic>.lance` exists with the **same** row count and timestamps as
  `topic.lance.<Topic>.timestamp`, prefer the standalone table for full-fidelity
  extraction.
- If the standalone table has **more** rows, it represents the native stream;
  align to `topic.lance.timestamp` via `asof` backward on `timestamp`.
- Standalone tables can exist without a corresponding column in `topic.lance`
  (e.g. `CleanV2PathWithVirtualTopic` in the reference clip) — consumers must
  list `*.lance` directories under the clip to discover them.

## 3. Invariants

1. Every clip directory contains at least `meta.lance` and `topic.lance`.
2. `wm.lance.timestamp == topic.lance.timestamp` (identical ordering and count).
3. `topic.lance.timestamp` is strictly monotonically increasing.
4. For each keyframe row, at most one camera struct has a non-null
   `video_frame_timestamp`, and when present that value equals the row's
   `timestamp`.
5. All topic-struct `timestamp` fields satisfy
   `meta.start_time <= t <= meta.end_time`.
6. `mp4_path` keys are a subset of the camera columns in `topic.lance`.
7. `vehicle_info` never contains negative values (millimeters).

## 4. Storage format constraints

- Lance dataset format version `2.0.0`, storage version up to `2.2`.
- `map<…>` logical types are used in `meta.lance` — readers require
  **`pylance >= 4.0`** (or any Lance binding compiled against lance-core
  supporting storage v2.2 + map logical type). The repo's Python environment
  must have `pylance>=4.0.0` installed.
- All text payloads in `topic.lance` / `<Topic>.lance` use `large_string`
  (>2 GiB-safe) — callers must not assume 32-bit-indexed `string`.

## 5. Video playback (MP4) strategy

`meta.mp4_path` points to remote (OSS) MP4 files. The platform exposes two
modes to the Web Explorer:

1. **Metadata mode (always available)** — the UI lists every camera, its pose,
   fov, resolution (from `calibration_info`), and the OSS URI. If no local
   cache is present, the UI shows a "Not cached locally" badge together with
   the OSS path.
2. **Playback mode (local cache)** — when a file exists at
   `data/raw/thumbnail_video/<clip_id>/<cam>.mp4`, the API serves it via HTTP
   Range to the `<video>` element. Frame alignment is provided by
   `topic.lance.<camN>.video_frame_index`; the UI can seek to
   `index / fps` when fps is available from `calibration_info.<cam>.properties`.

Thumbnail caches are populated by `apps/api/src/scripts/download_oss_data.py`
(or manually via `ossutil`). The script prefers `meta.mp4_resize_path[cam][0]`
— the lowest-resolution variant in the quality ladder — and falls back to
`meta.mp4_path[cam]` if no resize variants exist, streaming the object to
`data/raw/thumbnail_video/<clip_id>/<cam>.mp4`.

## 6. Discovery & catalog mapping

A clip is registered into the platform metadata catalog by the ingestion
workflow with the following mapping:

| Catalog entity           | Source                                                 |
|--------------------------|--------------------------------------------------------|
| `dataset_id`             | Clip directory name (`c-<uuid>`).                      |
| `dataset.name`           | `meta.vehicle_name + "@" + meta.city`.                 |
| `dataset.workspace_id`   | Profile default (e.g. `local-ad`).                     |
| `dataset_version.id`     | `meta.calibration_version`-derived, e.g. `v1`.         |
| `dataset_version.table_name` | `"topic.lance"`                                    |
| `dataset_version.sample_count` | `count_rows(topic.lance)`                        |
| Lineage `payload.clip_id`| `c-<uuid>`                                             |
| Lineage `payload.scenario` | `meta.scenario`                                      |

## 7. Reference queries

Compute the full JSON payload of `LocalPoseTopic` aligned to every keyframe:

```sql
SELECT
  timestamp,
  LocalPoseTopic.timestamp AS pose_ts,
  LocalPoseTopic.data      AS pose_json
FROM read_lance('data/lance/c-.../topic.lance')
WHERE LocalPoseTopic IS NOT NULL
ORDER BY timestamp
```

Find every keyframe with a `cam5` video frame:

```sql
SELECT timestamp, cam5.video_frame_index
FROM read_lance('data/lance/c-.../topic.lance')
WHERE cam5.video_frame_timestamp IS NOT NULL
```

Aligned stream-join against the native pose stream (10× rate):

```python
base  = lance.dataset('topic.lance').to_table(columns=['timestamp'])
pose  = lance.dataset('LocalPoseTopic.lance').to_table()
merged = duckdb.sql('''
  SELECT base.timestamp, pose.data
  FROM base ASOF JOIN pose
    ON base.timestamp >= pose.timestamp
''').df()
```

## 8. Evolution notes

- The set of topics per clip is producer-defined; any consumer that hard-codes
  the topic list is buggy. Always list `topic.lance.schema` and
  `glob("*.lance")` to drive table discovery.
- Typos observed in the wild (e.g. `XplannerDataBackfillTopic` vs. design
  proposal `XplannerBackFillTopic`) must not break ingestion: treat topic
  names as opaque identifiers.
- Cameras are sparse; e.g. the reference clip has `cam0, cam2..cam7` but no
  `cam1`. Downstream UI must render whatever is present.
