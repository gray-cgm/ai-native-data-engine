import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageContainer } from '@/shared/components/page-container'
import { PageError } from '@/shared/components/page-error'
import { getToolById } from '@/shared/microfrontends/registry'
import '../tools.css'

type FrameState = 'loading' | 'ready' | 'delayed'

const FRAME_TIMEOUT_MS = 5000

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
    if (frameState === 'ready') {
      return 'Embedded'
    }

    if (frameState === 'delayed') {
      return 'Needs attention'
    }

    return 'Connecting'
  }, [frameState])

  if (!tool) {
    return <PageError message="Unknown tool workspace." />
  }

  return (
    <PageContainer
      title={tool.name}
      description={tool.summary}
      actions={
        <div className="tool-actions-inline">
          <button type="button" onClick={() => setFrameKey((current) => current + 1)}>
            Reload frame
          </button>
          <a href={tool.baseUrl} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
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
              <p className="tools-eyebrow">Embedded runtime</p>
              <h3>{tool.baseUrl}</h3>
            </div>
            <div className={`tool-frame-status tool-frame-status-${frameState}`}>
              {statusLabel}
            </div>
          </div>

          <div className="tool-frame-shell">
            {frameState !== 'ready' ? (
              <div className="tool-frame-overlay">
                <h4>{frameState === 'delayed' ? 'Embedding is taking longer than expected' : 'Connecting to tool runtime'}</h4>
                <p className="text-muted">
                  {frameState === 'delayed'
                    ? 'If the vendor UI blocks framing or requires separate auth, use the new-tab entry while a gateway adapter is added.'
                    : 'The platform shell is opening the tool inside the workspace container.'}
                </p>
              </div>
            ) : null}

            <iframe
              key={`${tool.id}-${frameKey}`}
              className="tool-frame"
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