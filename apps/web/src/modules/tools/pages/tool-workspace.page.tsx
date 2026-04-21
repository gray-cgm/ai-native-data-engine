import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Tag, Space } from 'antd'
import { ReloadOutlined, LinkOutlined } from '@ant-design/icons'
import { PageContainer } from '@/shared/components/page-container'
import { PageError } from '@/shared/components/page-error'
import { StatusBadge } from '@/shared/components/status-badge'
import { useQuery } from '@/shared/hooks/use-query'
import { getToolById } from '@/shared/microfrontends/registry'
import { fetchRuns } from '@/modules/pipelines/api'
import '../tools.css'

type FrameState = 'loading' | 'ready' | 'delayed'

const FRAME_TIMEOUT_MS = 5000

function DelayedPanel({ tool, onReload }: { tool: ReturnType<typeof getToolById> & object; onReload: () => void }) {
  return (
    <div className="tool-delayed-panel">
      <div className="tool-delayed-hero">
        <div className="tool-card-badge tool-delayed-badge">{tool.icon}</div>
        <div>
          <p className="tools-eyebrow">Embedded console unavailable</p>
          <h3>{tool.name}</h3>
          <p className="text-muted">{tool.description}</p>
        </div>
      </div>

      <div className="tool-delayed-actions">
        <a className="tool-link-button" href={tool.baseUrl} target="_blank" rel="noreferrer">
          Open {tool.shortName} in new tab ↗
        </a>
        <button type="button" className="tool-link-secondary" onClick={onReload}>
          Retry embed
        </button>
      </div>

      <div className="tool-delayed-section">
        <p className="tools-eyebrow">Capabilities</p>
        <div className="tool-delayed-caps">
          {tool.capabilities.map((cap) => (
            <span key={cap} className="tool-list-item">{cap}</span>
          ))}
        </div>
      </div>

      {tool.quickLinks?.length ? (
        <div className="tool-delayed-section">
          <p className="tools-eyebrow">Quick access links</p>
          <div className="tool-delayed-links">
            {tool.quickLinks.map((link) => (
              <a
                key={link.path}
                className="tool-quick-link"
                href={`${tool.baseUrl}${link.path}`}
                target="_blank"
                rel="noreferrer"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <p className="tool-delayed-note text-muted">
        Some tools block iframe embedding via <code>X-Frame-Options</code> or <code>Content-Security-Policy</code>.
        Use the new-tab link above while a gateway adapter is configured.
      </p>
    </div>
  )
}

function LiveRunsCard() {
  const fetcher = useCallback(() => fetchRuns(), [])
  const { data, state, refetch } = useQuery(fetcher)
  const runs = data ?? []

  return (
    <article className="card tool-live-runs-card">
      <div className="tool-live-runs-header">
        <h3>Live runs</h3>
        <button type="button" className="tool-refresh-btn" onClick={refetch} title="Refresh runs">
          ↻
        </button>
      </div>
      {state === 'loading' && <p className="text-muted tool-live-runs-empty">Loading…</p>}
      {state === 'empty' && <p className="text-muted tool-live-runs-empty">No runs recorded yet.</p>}
      {state === 'error' && <p className="text-muted tool-live-runs-empty">Could not load runs.</p>}
      {state === 'ready' && (
        <ul className="tool-live-runs-list">
          {runs.slice(0, 6).map((run) => (
            <li key={run.run_id} className="tool-live-run-row">
              <StatusBadge status={run.status} />
              <span className="tool-live-run-job">{run.job_name}</span>
              <span className="tool-live-run-id">{run.run_id.slice(0, 8)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link className="tool-live-runs-more" to="/pipelines">
        View Pipeline Monitor →
      </Link>
    </article>
  )
}

export default function ToolWorkspacePage() {
  const { toolId } = useParams()
  const tool = getToolById(toolId)
  const [frameKey, setFrameKey] = useState(0)
  const [frameState, setFrameState] = useState<FrameState>('loading')

  useEffect(() => {
    if (!tool) {
      return
    }

    setFrameState('loading')
    const timeoutId = window.setTimeout(() => {
      setFrameState((current) => (current === 'loading' ? 'delayed' : current))
    }, FRAME_TIMEOUT_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [tool, frameKey])

  const statusLabel = useMemo(() => {
    if (frameState === 'ready') return 'Embedded'
    if (frameState === 'delayed') return 'Needs attention'
    return 'Connecting'
  }, [frameState])

  if (!tool) {
    return <PageError message="Unknown tool workspace." />
  }

  const handleReload = () => setFrameKey((k) => k + 1)

  return (
    <PageContainer
      title={tool.name}
      description={tool.summary}
      actions={
<<<<<<< HEAD
        <div className="tool-actions-inline">
          <button type="button" onClick={handleReload}>
=======
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => setFrameKey((current) => current + 1)}>
>>>>>>> b0a2d35 (feat: update ui)
            Reload frame
          </Button>
          <Button type="link" icon={<LinkOutlined />} href={tool.baseUrl} target="_blank" rel="noreferrer">
            Open in new tab
          </Button>
        </Space>
      }
    >
      <section className="tool-workspace-grid">
        <aside className="tool-workspace-sidebar">
          <article className="card tool-overview-card">
            <div className="tool-overview-top">
              <div className="tool-card-badge">{tool.icon}</div>
              <div>
                <p className="tools-eyebrow">Workspace route</p>
                <h3>{tool.route.label}</h3>
              </div>
            </div>
            <div className="tool-meta-stack">
              <div>
                <span className="tool-meta-label">Status</span>
                <strong>{statusLabel}</strong>
              </div>
              <div>
                <span className="tool-meta-label">Integration</span>
                <strong>{tool.integrationMode}</strong>
              </div>
              <div>
                <span className="tool-meta-label">Gateway path</span>
                <strong>{tool.gatewayPath}</strong>
              </div>
            </div>
          </article>

          {tool.quickLinks?.length ? (
            <article className="card">
              <h3>Quick access</h3>
              <p className="text-muted" style={{ marginBottom: 12, fontSize: 13 }}>
                Open specific sections of {tool.shortName} directly.
              </p>
              <div className="tool-quick-links-grid">
                {tool.quickLinks.map((link) => (
                  <a
                    key={link.path}
                    className="tool-quick-link"
                    href={`${tool.baseUrl}${link.path}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            </article>
          ) : null}

          {tool.showLiveRuns ? <LiveRunsCard /> : null}

          <article className="card">
            <h3>Why this tool belongs in the shell</h3>
            <p className="text-muted">{tool.description}</p>
            <div className="tool-list-block">
              {tool.useCases.map((item) => (
                <span key={item} className="tool-list-item">
                  {item}
                </span>
              ))}
            </div>
          </article>

          <article className="card">
            <h3>Capability contract</h3>
            <ul className="tool-bullet-list">
              {tool.capabilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          {tool.notes?.length ? (
            <article className="card">
              <h3>Integration notes</h3>
              <ul className="tool-bullet-list">
                {tool.notes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ) : null}

          <article className="card">
            <h3>Shell routes</h3>
            <div className="tool-route-list">
              <Link to="/tools">Tools hub</Link>
              <Link to={tool.route.path}>{tool.route.label}</Link>
            </div>
          </article>
        </aside>

        <section className="tool-frame-panel card">
          <div className="tool-frame-header">
            <div>
              <p className="tools-eyebrow">{tool.category} console</p>
              <h3>{tool.baseUrl}</h3>
            </div>
            <Tag color={frameState === 'ready' ? 'success' : frameState === 'delayed' ? 'warning' : 'processing'}>
              {statusLabel}
            </Tag>
          </div>

          <div className="tool-frame-shell">
            {frameState === 'loading' ? (
              <div className="tool-frame-overlay">
                <h4>Connecting to tool runtime</h4>
                <p className="text-muted">
                  The platform shell is opening {tool.shortName} inside the workspace container.
                </p>
              </div>
            ) : null}

            {frameState === 'delayed' ? (
              <DelayedPanel tool={tool} onReload={handleReload} />
            ) : null}

            <iframe
              key={`${tool.id}-${frameKey}`}
              className={`tool-frame ${frameState !== 'ready' ? 'tool-frame-hidden' : ''}`}
              title={`${tool.name} workspace`}
              src={tool.baseUrl}
              onLoad={() => setFrameState('ready')}
            />
          </div>
        </section>
      </section>
    </PageContainer>
  )
}
