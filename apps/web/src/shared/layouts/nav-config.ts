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
  VideoCameraOutlined,
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
      { label: 'Clips', path: '/explorer/clips', icon: VideoCameraOutlined },
    ],
  },
  {
    label: 'Operations',
    icon: ControlOutlined,
    items: [
      { label: 'Tasks', path: '/ops', icon: UnorderedListOutlined },
      { label: 'Exports', path: '/ops/exports', icon: ExportOutlined },
    ],
  },
  {
    label: 'Pipelines',
    icon: SyncOutlined,
    items: [{ label: 'Pipeline Monitor', path: '/pipelines', icon: HistoryOutlined }],
  },
  {
    label: 'Tools',
    icon: ToolOutlined,
    items: [
      { label: 'Tools Hub', path: '/tools', icon: AppstoreOutlined },
      { label: 'Dagster', path: '/tools/dagster', icon: RocketOutlined },
      { label: 'Superset', path: '/tools/superset', icon: BarChartOutlined },
      { label: 'Jupyter', path: '/tools/jupyter', icon: CodeOutlined },
    ],
  },
]
