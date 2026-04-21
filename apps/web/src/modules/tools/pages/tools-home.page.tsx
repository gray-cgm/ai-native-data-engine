import { Link } from 'react-router-dom'
import { Button } from 'antd'
import { RocketOutlined } from '@ant-design/icons'
import { PageContainer } from '@/shared/components/page-container'
import { StatCard } from '@/shared/components/stat-card'
import { toolRegistry } from '@/shared/microfrontends/registry'
import { ToolCard } from '../components/tool-card'
import '../tools.css'

const engineLayers = [
  {
    title: 'Platform shell',
    body: 'Owns global navigation, workspace switching, permissions, and unified task context.',
  },
  {
    title: 'Tool registry',
    body: 'Defines each tool as a routable micro-app with entry URL, capabilities, gateway path, and policy metadata.',
  },
  {
    title: 'Access gateway',
    body: 'Normalizes auth, headers, CSP, and deep-link routing before traffic reaches Dagster, Superset, or Jupyter.',
  },
  {
    title: 'Tool bridge',
    body: 'Carries workspace context, dataset identifiers, and future cross-app events between shell and embedded tools.',
  },
]

export default function ToolsHomePage() {
  const iframeTools = toolRegistry.filter((tool) => tool.integrationMode === 'direct-iframe').length
  const proxyTools = toolRegistry.filter((tool) => tool.integrationMode === 'proxy-iframe').length

  return (
    <PageContainer
      title="Platform Tools"
      description="A microfrontend engine for integrating orchestration, BI, and notebook tools into one data platform shell."
      actions={
        <Link to="/tools/dagster">
          <Button type="primary" icon={<RocketOutlined />}>
            Launch first workspace
          </Button>
        </Link>
      }
    >
      <section className="tools-hero card">
        <div>
          <p className="tools-eyebrow">Microfrontend engine</p>
          <h3>One platform shell, many specialized data tools</h3>
          <p className="text-muted tools-hero-copy">
            The shell stays responsible for navigation, tenancy, auth, and context. Individual tools stay specialized. That split lets you integrate Dagster, Superset, and Jupyter without collapsing everything into one oversized frontend.
          </p>
        </div>
        <div className="grid-four tools-stat-grid">
          <StatCard label="Integrated tools" value={toolRegistry.length} />
          <StatCard label="Direct iframe adapters" value={iframeTools} />
          <StatCard label="Gateway-first adapters" value={proxyTools} />
          <StatCard label="Shell-owned routes" value={toolRegistry.length + 1} />
        </div>
      </section>

      <section className="tools-engine-grid">
        {engineLayers.map((layer) => (
          <article key={layer.title} className="card tools-engine-card">
            <p className="tools-eyebrow">Engine layer</p>
            <h3>{layer.title}</h3>
            <p className="text-muted">{layer.body}</p>
          </article>
        ))}
      </section>

      <section className="page-header tools-section-header">
        <div>
          <h3>Tool catalog</h3>
          <p className="text-muted">Each tool is declared in a shared registry, then rendered through a dedicated workspace route.</p>
        </div>
      </section>

      <section className="tools-card-grid">
        {toolRegistry.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </section>
    </PageContainer>
  )
}