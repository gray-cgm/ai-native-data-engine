import { resolveGatewayPath, resolveToolBaseUrl } from './runtime'
import type { ToolDescriptor } from './types'

const dagsterBaseUrl = resolveToolBaseUrl(3001, import.meta.env.VITE_DAGSTER_BASE)
const supersetBaseUrl = resolveToolBaseUrl(8088, import.meta.env.VITE_SUPERSET_BASE)
const jupyterBaseUrl = resolveToolBaseUrl(8888, import.meta.env.VITE_JUPYTER_BASE)
const kafkaUiBaseUrl = resolveToolBaseUrl(8085, import.meta.env.VITE_KAFKA_UI_BASE)

export const toolRegistry: ToolDescriptor[] = [
  {
    id: 'dagster',
    name: 'Dagster Control Plane',
    shortName: 'Dagster',
    icon: 'DR',
    category: 'orchestration',
    summary: 'Pipeline orchestration, asset materialization, and run operations.',
    description:
      'Dagster is hosted as a micro-app inside the platform shell so operators can jump from task context into asset health, runs, and sensors without leaving the workbench.',
    integrationMode: 'direct-iframe',
    baseUrl: dagsterBaseUrl,
    gatewayPath: resolveGatewayPath('/api/tools-gateway/dagster/'),
    healthPath: '/server_info',
    docsPath: '/docs',
    workspacePath: '/tools/dagster',
    capabilities: ['Asset catalog', 'Run queue visibility', 'Backfills', 'Sensors and schedules'],
    useCases: ['Inspect materializations', 'Trigger assets', 'Debug failed runs'],
    route: {
      path: '/tools/dagster',
      label: 'Dagster',
    },
    notes: ['Current shell uses direct iframe embedding in local dev.', 'Production should route Dagster through a platform gateway for shared auth and audit headers.'],
    quickLinks: [
      { label: 'Asset catalog', path: '/asset-groups' },
      { label: 'Run history', path: '/runs' },
      { label: 'Sensors', path: '/sensors' },
      { label: 'Schedules', path: '/schedules' },
    ],
    showLiveRuns: true,
  },
  {
    id: 'superset',
    name: 'Superset BI Studio',
    shortName: 'Superset',
    icon: 'BI',
    category: 'analytics',
    summary: 'Dashboards, SQL lab, chart exploration, and governed analytics.',
    description:
      'Superset is modeled as an analytics micro-app that receives platform navigation context and opens inside a dedicated work area for embedded BI workflows.',
    integrationMode: 'proxy-iframe',
    baseUrl: supersetBaseUrl,
    gatewayPath: resolveGatewayPath('/api/tools-gateway/superset/'),
    healthPath: '/health',
    docsPath: '/swagger/v1',
    workspacePath: '/tools/superset',
    capabilities: ['Dashboard viewing', 'Ad hoc SQL', 'Semantic datasets', 'Chart authoring'],
    useCases: ['Explore aggregates', 'Publish metrics', 'Share BI views'],
    route: {
      path: '/tools/superset',
      label: 'Superset',
    },
    notes: ['Superset often needs frame and auth hardening before production embedding.', 'Recommended production shape is gateway proxy plus token exchange for embedded sessions.'],
    quickLinks: [
      { label: 'Dashboards', path: '/dashboard/list' },
      { label: 'SQL Lab', path: '/sqllab' },
      { label: 'Charts', path: '/chart/list' },
      { label: 'Datasets', path: '/tablemodelview/list' },
    ],
  },
  {
    id: 'jupyter',
    name: 'Jupyter Lab Workspace',
    shortName: 'Jupyter',
    icon: 'NB',
    category: 'notebook',
    summary: 'Notebook authoring, exploratory analysis, and quick validation loops.',
    description:
      'Jupyter runs as a notebook micro-app for researchers and engineers who need rapid data inspection while staying inside the platform entry point.',
    integrationMode: 'direct-iframe',
    baseUrl: jupyterBaseUrl,
    gatewayPath: resolveGatewayPath('/api/tools-gateway/jupyter/'),
    healthPath: '/api/status',
    workspacePath: '/tools/jupyter',
    capabilities: ['Notebook editing', 'Kernel execution', 'Exploratory analysis', 'Ad hoc profiling'],
    useCases: ['Validate samples', 'Prototype queries', 'Inspect intermediate artifacts'],
    route: {
      path: '/tools/jupyter',
      label: 'Jupyter',
    },
    notes: ['The local compose service already mounts the repo into the notebook workspace.', 'Production should isolate kernels per user or per workspace boundary.'],
    quickLinks: [
      { label: 'Notebooks', path: '/lab/tree' },
      { label: 'File browser', path: '/lab' },
    ],
  },
  {
    id: 'kafka-ui',
    name: 'Kafka UI Console',
    shortName: 'Kafka UI',
    icon: 'KF',
    category: 'streaming',
    summary: 'Topic browser, consumer-group lag, and DLQ inspection for the streaming pipeline.',
    description:
      'Kafka UI is the streaming counterpart to the Dagster console. It shows topic backlog, consumer-group lag, and DLQ traffic so operators can debug the streaming pipeline without leaving the platform shell.',
    integrationMode: 'direct-iframe',
    baseUrl: kafkaUiBaseUrl,
    gatewayPath: resolveGatewayPath('/api/tools-gateway/kafka-ui/'),
    healthPath: '/actuator/health',
    workspacePath: '/tools/kafka-ui',
    capabilities: ['Topic browse', 'Consumer-group lag', 'DLQ inspection', 'Live messages tail'],
    useCases: ['Diagnose streaming backlog', 'Replay events from DLQ', 'Audit x_trace_id flows'],
    route: {
      path: '/tools/kafka-ui',
      label: 'Kafka UI',
    },
    notes: [
      'Local dev uses provectuslabs/kafka-ui on port KAFKA_UI_PORT (default 8085).',
      'Production should front kafka-ui through the platform gateway with workspace-scoped auth.',
    ],
    quickLinks: [
      { label: 'Topics', path: '/ui/clusters' },
      { label: 'Consumer groups', path: '/ui/clusters' },
      { label: 'Brokers', path: '/ui/clusters' },
    ],
  },
]

export function getToolById(toolId?: string) {
  return toolRegistry.find((tool) => tool.id === toolId)
}

export function getToolEmbedUrl(tool: ToolDescriptor) {
  return tool.integrationMode === 'proxy-iframe' ? tool.gatewayPath : tool.baseUrl
}