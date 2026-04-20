import { useCallback, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { PageSuccess } from '@/shared/components/page-success'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchRequirementDetail, signOffTask } from '../api'
import type { DataTaskView } from '../api'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-info)',
}

export default function RequirementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const fetcher = useCallback(() => fetchRequirementDetail(id!), [id])
  const { data, state, error, refetch } = useQuery(fetcher)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [signingOff, setSigningOff] = useState<string | null>(null)

  async function handleSignOff(taskId: string, approved: boolean) {
    setSigningOff(taskId)
    try {
      await signOffTask(taskId, approved, 'admin')
      setSuccessMessage(approved ? 'Task approved successfully.' : 'Task rejected.')
      await refetch()
    } catch {
      setSuccessMessage('Sign-off failed. Please try again.')
    } finally {
      setSigningOff(null)
    }
  }

  if (state === 'loading') {
    return <PageLoading message="Loading requirement..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  if (!data) {
    return (
      <PageContainer title="Requirement Not Found">
        <div className="card">
          <p className="text-muted">Requirement not found.</p>
          <Link to="/requirements"><button>Back to Requirements</button></Link>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={data.title}
      description={`Requirement ${data.id.slice(0, 8)}… · ${data.source} · ${data.priority}`}
      actions={
        <Link to="/requirements"><button>Back to list</button></Link>
      }
    >
      {successMessage && (
        <PageSuccess
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          autoCloseDuration={3000}
        />
      )}

      {/* Requirement Info Card */}
      <div className="grid-two" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="card">
          <h3>Requirement Info</h3>
          <table>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: 160 }}>Status</td>
                <td><StatusBadge status={data.status} /></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Priority</td>
                <td>
                  <span style={{ color: PRIORITY_COLORS[data.priority] ?? 'inherit', fontWeight: 600 }}>
                    {data.priority}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Source</td>
                <td>{data.source}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>DRE Owner</td>
                <td>{data.dre_owner}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Due Date</td>
                <td>{data.due_date ?? '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Est. Volume</td>
                <td>{data.estimated_data_volume != null ? data.estimated_data_volume.toLocaleString() : '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Created</td>
                <td>{new Date(data.created_at).toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Updated</td>
                <td>{new Date(data.updated_at).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Description & Tags</h3>
          <p style={{ lineHeight: 1.7, marginBottom: 'var(--space-lg)' }}>
            {data.description || <span className="text-muted">No description provided.</span>}
          </p>
          {data.target_scene && (
            <p style={{ marginBottom: 'var(--space-md)' }}>
              <strong>Target Scene:</strong> {data.target_scene}
            </p>
          )}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <strong>Scene Tags:</strong>{' '}
            {(data.scene_tags ?? []).length > 0 ? (
              (data.scene_tags ?? []).map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    marginRight: 4,
                    marginBottom: 2,
                    borderRadius: 12,
                    background: 'var(--color-bg-secondary)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-muted">None</span>
            )}
          </div>
          <div>
            <strong>Vehicle Tags:</strong>{' '}
            {(data.vehicle_tags ?? []).length > 0 ? (
              (data.vehicle_tags ?? []).map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    marginRight: 4,
                    marginBottom: 2,
                    borderRadius: 12,
                    background: 'var(--color-bg-secondary)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-muted">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Data Tasks */}
      <div className="card">
        <h3>Data Tasks ({data.data_tasks.length})</h3>
        {data.data_tasks.length === 0 ? (
          <p className="text-muted">No data tasks created for this requirement.</p>
        ) : (
          <DataTable
            columns={[
              { key: 'title', header: 'Title' },
              { key: 'task_type', header: 'Type' },
              {
                key: 'status',
                header: 'Status',
                render: (row: DataTaskView) => <StatusBadge status={row.status} />,
              },
              { key: 'assigned_to', header: 'Assignee', render: (row: DataTaskView) => row.assigned_to || '—' },
              {
                key: 'sign_off_status',
                header: 'Sign-off',
                render: (row: DataTaskView) => <StatusBadge status={row.sign_off_status} />,
              },
              {
                key: '_progress',
                header: 'Progress',
                render: (row: DataTaskView) => `${row.actual_count} / ${row.target_count}`,
              },
              {
                key: '_actions',
                header: 'Actions',
                render: (row: DataTaskView) => {
                  if (row.sign_off_status !== 'pending') return null
                  const isProcessing = signingOff === row.id
                  return (
                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                      <button
                        onClick={() => handleSignOff(row.id, true)}
                        disabled={isProcessing}
                        style={{ background: 'var(--color-success)', fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}
                      >
                        {isProcessing ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleSignOff(row.id, false)}
                        disabled={isProcessing}
                        style={{ background: 'var(--color-danger)', fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}
                      >
                        {isProcessing ? '...' : 'Reject'}
                      </button>
                    </div>
                  )
                },
              },
            ]}
            data={data.data_tasks}
            rowKey={(row) => row.id}
          />
        )}
      </div>
    </PageContainer>
  )
}
