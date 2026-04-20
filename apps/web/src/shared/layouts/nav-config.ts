export interface NavItem {
  label: string
  path: string
}

export interface NavGroup {
  label: string
  icon: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    icon: '🏠',
    items: [{ label: 'Overview', path: '/' }],
  },
  {
    label: 'Catalog',
    icon: '📦',
    items: [{ label: 'Datasets', path: '/catalog' }],
  },
  {
    label: 'Requirements',
    icon: '📋',
    items: [{ label: 'Requirements', path: '/requirements' }],
  },
  {
    label: 'Explorer',
    icon: '🔍',
    items: [
      { label: 'Distribution', path: '/explorer' },
      { label: 'Search', path: '/explorer/search' },
    ],
  },
  {
    label: 'Operations',
    icon: '🏭',
    items: [
      { label: 'Tasks', path: '/ops' },
      { label: 'Exports', path: '/ops/exports' },
    ],
  },
  {
    label: 'Pipelines',
    icon: '🔄',
    items: [{ label: 'Run History', path: '/pipelines' }],
  },
  {
    label: 'Tools',
    icon: '🧩',
    items: [
      { label: 'Tools Hub', path: '/tools' },
      { label: 'Dagster', path: '/tools/dagster' },
      { label: 'Superset', path: '/tools/superset' },
      { label: 'Jupyter', path: '/tools/jupyter' },
    ],
  },
]
