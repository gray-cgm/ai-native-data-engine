import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { StatusBadge } from '@/shared/components/status-badge'
import { StatCard } from '@/shared/components/stat-card'
import type { RunItem, StreamingBatchSummary, StreamingSummary } from '@/shared/types/common'
import { fetchRuns, fetchStreamingSummary } from '../api'
import '../pipelines.css'

const PAGE_SIZE = 8

// ── Filter fns are module-level so their references are stable ─

function filterRun(run: RunItem, q: string) {
  return (
    run.job_name.toLowerCase().includes(q) ||
    run.run_id.toLowerCase().includes(q) ||
    run.status.toLowerCase().includes(q)
  )
}

function filterBatch(batch: StreamingBatchSummary, q: string) {
  return String(batch.batch_number).includes(q) || batch.run_status.toLowerCase().includes(q)
}

function getPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

// ── usePaginatedSearch ────────────────────────────────────── 

function usePaginatedSearch<T>(
  items: T[],
  filterFn: (item: T, keyword: string) => boolean,
) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return q ? items.filter((item) => filterFn(item, q)) : items
  }, [items, keyword, filterFn])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const onKeyword = useCallback((v: string) => {
    setKeyword(v)
    setPage(1)
  }, [])

  return { keyword, onKeyword, page: safePage, setPage, pageCount, pageItems, total: filtered.length }
}

// ── SearchBar ─────────────────────────────────────────────── 

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="pipeline-search">
      <span className="pipeline-search-icon" aria-hidden>
        🔍
      </span>
      <input
        type="search"
        className="pipeline-search-input"
        placeholder={placeholder ?? 'Search…'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

// ── Pagination ────────────────────────────────────────────── 

function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number
  pageCount: number
  total: number
  onPage: (p: number) => void
}) {
  if (pageCount <= 1) return null
  const range = getPageRange(page, pageCount)

  return (
    <div className="pipeline-pagination">
      <span className="pipeline-pagination-info">{total} total</span>
      <div className="pipeline-pagination-controls">
        <button
          type="button"
          className="pipeline-page-btn"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>

        {range.map((item, idx) =>
          item === '…' ? (
            // biome-ignore lint: index key is fine for stable ellipsis separators
            <span key={`ellipsis-${idx}`} className="pipeline-page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`pipeline-page-btn ${item === page ? 'pipeline-page-btn-active' : ''}`}
              onClick={() => onPage(item as number)}
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className="pipeline-page-btn"
          disabled={page === pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  )
}

// ── BatchRunsSection ──────────────────────────────────────── 

function BatchRunsSection({ runs, loading }: { runs: RunItem[]; loading: boolean }) {
  const { keyword, onKeyword, page, setPage, pageCount, pageItems, total } = usePaginatedSearch(
    runs,
    filterRun,
  )

  return (
    <section className="pipeline-section card">
      <div className="pipeline-section-header">
        <div>
          <p className="pipeline-eyebrow">Batch processing</p>
          <h3>Dagster runs</h3>
        </div>
        <a
          className="pipeline-external-link"
          href="http://localhost:3001"
          target="_blank"
          rel="noreferrer"
        >
          Open Dagster console ↗
        </a>
      </div>

      {loading && <p className="pipeline-empty text-muted">Loading runs…</p>}

      {!loading && runs.length === 0 && (
        <div className="pipeline-empty-state">
          <p className="text-muted">No batch runs recorded yet.</p>
          <p className="text-muted pipeline-hint">
            Run <code>make ingest</code> or trigger a Dagster job to see results here.
          </p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <>
          <div className="pipeline-toolbar">
            <SearchBar
              value={keyword}
              onChange={onKeyword}
              placeholder="Search by job name, run ID or status…"
            />
            <span className="pipeline-count">
              {total} run{total !== 1 ? 's' : ''}
            </span>
          </div>

          {pageItems.length === 0 ? (
            <p className="text-muted pipeline-empty">No runs match &ldquo;{keyword}&rdquo;.</p>
          ) : (
            <table className="pipeline-table">
              <thead>
                <tr>
                  <th>Job name</th>
                  <th>Status</th>
                  <th>Run ID</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((run) => (
                  <tr key={run.run_id}>
                    <td className="pipeline-job-name">{run.job_name}</td>
                    <td>
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="pipeline-run-id">{run.run_id.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
        </>
      )}

      <div className="pipeline-section-footer">
        <Link to="/tools/dagster" className="pipeline-tool-link">
          View full Dagster workspace →
        </Link>
      </div>
    </section>
  )
}

// ── StreamingSection ──────────────────────────────────────── 

function StreamingSection({
  summary,
  loading,
}: {
  summary: StreamingSummary | null
  loading: boolean
}) {
  const batches = summary?.batch_summaries ?? []
  const { keyword, onKeyword, page, setPage, pageCount, pageItems, total } = usePaginatedSearch(
    batches,
    filterBatch,
  )

  return (
    <section className="pipeline-section card">
      <div className="pipeline-section-header">
        <div>
          <p className="pipeline-eyebrow">Streaming processing</p>
          <h3>Event pipeline</h3>
        </div>
      </div>

      {loading && <p className="pipeline-empty text-muted">Loading summary…</p>}

      {!loading && !summary && (
        <div className="pipeline-empty-state">
          <p className="text-muted">No streaming data available yet.</p>
          <p className="text-muted pipeline-hint">
            Run <code>make lance</code> to bootstrap the local streaming pipeline.
          </p>
        </div>
      )}

      {!loading && summary && (
        <>
          <div className="pipeline-stream-stats">
            <StatCard label="Total events" value={summary.event_count} />
            <StatCard
              label="Deduplicated"
              value={summary.event_count - summary.duplicate_events_skipped}
            />
            <StatCard label="Batches" value={summary.batch_count} />
            <StatCard label="Latest samples" value={summary.latest_sample_count} />
          </div>

          {summary.distribution.length > 0 && (
            <div className="pipeline-distribution">
              <p className="pipeline-eyebrow" style={{ marginBottom: 10 }}>
                Scene distribution
              </p>
              {summary.distribution.map((row) => (
                <div key={row.scene} className="pipeline-dist-row">
                  <span className="pipeline-dist-label">{row.scene}</span>
                  <div className="pipeline-dist-bar-wrap">
                    <div
                      className="pipeline-dist-bar"
                      style={{
                        width: `${Math.round((row.sample_count / summary.latest_sample_count) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="pipeline-dist-count">{row.sample_count}</span>
                </div>
              ))}
            </div>
          )}

          {batches.length > 0 && (
            <div className="pipeline-batch-history">
              <div className="pipeline-toolbar">
                <SearchBar
                  value={keyword}
                  onChange={onKeyword}
                  placeholder="Search by batch # or status…"
                />
                <span className="pipeline-count">
                  {total} batch{total !== 1 ? 'es' : ''}
                </span>
              </div>

              {pageItems.length === 0 ? (
                <p className="text-muted pipeline-empty">
                  No batches match &ldquo;{keyword}&rdquo;.
                </p>
              ) : (
                <table className="pipeline-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Events in</th>
                      <th>Accepted</th>
                      <th>New samples</th>
                      <th>Run status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((b) => (
                      <tr key={b.batch_number}>
                        <td className="pipeline-batch-num">#{b.batch_number}</td>
                        <td>{b.input_events}</td>
                        <td>{b.accepted_events}</td>
                        <td>{b.unique_samples}</td>
                        <td>
                          <StatusBadge status={b.run_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────── 

export default function RunHistoryPage() {
  const runsFetcher = useCallback(() => fetchRuns(), [])
  const streamFetcher = useCallback(() => fetchStreamingSummary(), [])

  const {
    data: runs,
    state: runsState,
    error: runsError,
    refetch: refetchRuns,
  } = useQuery(runsFetcher, {
    isEmpty: (d) => (d as RunItem[]).length === 0,
  })
  const { data: streaming, state: streamState, refetch: refetchStream } = useQuery(streamFetcher)

  if (runsState === 'loading' && streamState === 'loading') {
    return <PageLoading message="Loading pipeline data…" />
  }

  if (runsState === 'error') {
    return (
      <PageContainer title="Pipeline Monitor" description="Batch and streaming pipeline activity.">
        <div className="card pipeline-error">
          <p className="text-muted">{runsError?.message ?? 'Failed to load pipeline runs.'}</p>
          <button type="button" onClick={refetchRuns}>
            Retry
          </button>
        </div>
      </PageContainer>
    )
  }

  const runList = runs ?? []
  const doneCount = runList.filter((r) => r.status === 'done' || r.status === 'completed').length
  const failedCount = runList.filter((r) => r.status === 'failed').length

  return (
    <PageContainer
      title="Pipeline Monitor"
      description="Unified view of batch and streaming pipeline activity."
      actions={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              void refetchRuns()
              void refetchStream()
            }}
          >
            Refresh
          </button>
          <a
            className="pipeline-dagster-btn"
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
          >
            Open Dagster ↗
          </a>
        </div>
      }
    >
      <div className="pipeline-summary-row">
        <StatCard label="Total runs" value={runList.length} />
        <StatCard label="Completed" value={doneCount} />
        <StatCard label="Failed" value={failedCount} />
        <StatCard label="Streaming batches" value={streaming?.batch_count ?? '—'} />
        <StatCard label="Streaming events" value={streaming?.event_count ?? '—'} />
      </div>

      <div className="pipeline-monitor-grid">
        <BatchRunsSection runs={runList} loading={runsState === 'loading'} />
        <StreamingSection summary={streaming ?? null} loading={streamState === 'loading'} />
      </div>
    </PageContainer>
  )
}
