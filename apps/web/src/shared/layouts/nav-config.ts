import type { ComponentType } from 'react'
import {
  HomeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  FormOutlined,
  SearchOutlined,
  PieChartOutlined,
  ControlOutlined,
  UnorderedListOutlined,
  ExportOutlined,
  SyncOutlined,
  HistoryOutlined,
  ToolOutlined,
  RocketOutlined,
  BarChartOutlined,
  CodeOutlined,
  ClusterOutlined,
  TagsOutlined,
  HighlightOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  SendOutlined,
  BranchesOutlined,
  DollarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

export interface NavItem {
  label: string
  path: string
  icon?: ComponentType
}

export interface NavGroup {
  label: string
  icon: ComponentType
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    icon: HomeOutlined,
    items: [{ label: 'Overview', path: '/', icon: DashboardOutlined }],
  },
  {
    label: 'Catalog',
    icon: DatabaseOutlined,
    items: [{ label: 'Datasets', path: '/catalog', icon: AppstoreOutlined }],
  },
  {
    label: 'Requirements',
    icon: FileTextOutlined,
    items: [{ label: 'Requirements', path: '/requirements', icon: FormOutlined }],
  },
  {
    label: 'Explorer',
    icon: SearchOutlined,
    items: [
      { label: 'Distribution', path: '/explorer', icon: PieChartOutlined },
      { label: 'Search', path: '/explorer/search', icon: SearchOutlined },
    ],
  },
  {
    label: 'Operations',
    icon: ControlOutlined,
    items: [
      { label: 'Operations Tasks', path: '/ops', icon: UnorderedListOutlined },
      { label: 'Labeling', path: '/ops/labeling', icon: HighlightOutlined },
      { label: 'Tagging', path: '/ops/tagging', icon: TagsOutlined },
      { label: 'Checking', path: '/ops/checking', icon: SafetyCertificateOutlined },
      { label: 'Mining', path: '/ops/mining', icon: ExperimentOutlined },
      { label: 'Release', path: '/ops/release', icon: SendOutlined },
      { label: 'Exports', path: '/ops/exports', icon: ExportOutlined },
    ],
  },
  {
    label: 'Pipelines',
    icon: SyncOutlined,
    items: [
      { label: 'Overview', path: '/pipelines?tab=overview', icon: DashboardOutlined },
      { label: 'Runs', path: '/pipelines?tab=runs', icon: ThunderboltOutlined },
      { label: 'Lineage', path: '/pipelines?tab=lineage', icon: BranchesOutlined },
      { label: 'Quality', path: '/pipelines?tab=quality', icon: SafetyCertificateOutlined },
      { label: 'Cost', path: '/pipelines?tab=cost', icon: DollarOutlined },
    ],
  },
  {
    label: 'Exports',
    icon: ExportOutlined,
    items: [
      { label: 'Snapshots', path: '/exports?tab=snapshots', icon: HistoryOutlined },
      { label: 'Consumers', path: '/exports?tab=consumers', icon: UnorderedListOutlined },
      { label: 'Hard Samples', path: '/exports?tab=hard-samples', icon: ExperimentOutlined },
      { label: 'ROI', path: '/exports?tab=roi', icon: BarChartOutlined },
    ],
  },
  {
    label: 'Tools',
    icon: ToolOutlined,
    items: [
      { label: 'Tools Hub', path: '/tools', icon: AppstoreOutlined },
      { label: 'Dagster', path: '/tools/dagster', icon: RocketOutlined },
      { label: 'Superset', path: '/tools/superset', icon: BarChartOutlined },
      { label: 'Jupyter', path: '/tools/jupyter', icon: CodeOutlined },
      { label: 'Kafka UI', path: '/tools/kafka-ui', icon: ClusterOutlined },
    ],
  },
]
