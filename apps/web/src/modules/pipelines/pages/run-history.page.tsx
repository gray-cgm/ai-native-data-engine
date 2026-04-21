import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { StatusBadge } from '@/shared/components/status-badge'
import { StatCard } from '@/shared/components/stat-card'
import type { RunItem, StreamingSummary } from '@/shared/types/common'
import { fetchRuns, fetchStreamingSummary } from '../api'
import '../pipelines.css'

function BatchRunsSection({ runs, loading }: { runs: RunItem[]; loading: boolean }) {
  return (
    <section className="pipeline-section card">
      <div className="pipeline-section-header">
        <div>
          <p className="pipeline-eyebrow">Batch processing</p>
          <h3>Dagster runs</h3>
        </div>
        <a className="pipeline-external-link" href="http://localhost:3001" target="_blank" rel="noreferrer">
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
        <table className="pipeline-table">
          <thead>
            <tr>
              <th>Job name</th>
              <th>Status</th>
              <th>Run ID</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.run_id}>
                <td className="pipeline-job-name">{run.job_name}</td>
                <td><StatusBadge status={run.status} /></td>
                <td className="pipeline-run-id">{run.run_id.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pipeline-section-footer">
        <Link to="/tools/dagster" className="pipeline-tool-link">
          View full Dagster workspace →
        </Link>
      </div>
    </section>
  )
}

function StreamingSection({ summary, loading }: { summary: StreamingSummary | null; loading: boolean }) {
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
            <StatCard label="Deduplicated" value={summary.event_count - summary.duplicate_events_skipped} />
            <StatCard label="Batches" value={summary.batch_count} />
            <StatCard label="Latest samples" value={summary.latest_sample_count} />
          </div>

          {summary.distribution.length > 0 && (
            <div className="pipeline-distribution">
              <p className="pipeline-eyebrow" style={{ marginBottom: 10 }}>Scene distribution</p>
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

          {summary.batch_summaries.length > 0 && (
            <div className="pipeline-batch-history">
              <p className="pipeline-eyebrow" style={{ marginBottom: 10 }}>Batch history</p>
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
                  {summary.batch_summaries.map((b) => (
                    <tr key={b.batch_number}>
                      <td className="pipeline-batch-num">#{b.batch_number}</td>
                      <td>{b.input_events}</td>
                      <td>{b.accepted_events}</td>
                      <td>{b.unique_samples}</td>
                      <td><StatusBadge status={b.run_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default function RunHistoryPage() {
  const runsFetcher = useCallback(() => fetchRuns(), [])
  const streamFetcher = useCallback(() => fetchStreamingSummary(), [])

  const { data: runs, state: runsState, error: runsError, refetch: refetchRuns } = useQuery(runsFetcher, {
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
          <button type="button" onClick={refetchRuns}>Retry</button>
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
          <button type="button" onClick={() => { void refetchRuns(); void refetchStream() }}>
            Refresh
          </button>
          <a className="pipeline-dagster-btn" href="http://localhost:3001" target="_blank" rel="noreferrer">
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
