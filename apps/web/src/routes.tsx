import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'
import { MainLayout } from './shared/layouts/main-layout'

const OverviewPage = lazy(() => import('./modules/overview/pages/overview.page'))
const DatasetListPage = lazy(() => import('./modules/catalog/pages/dataset-list.page'))
const DatasetDetailPage = lazy(() => import('./modules/catalog/pages/dataset-detail.page'))
const DistributionPage = lazy(() => import('./modules/explorer/pages/distribution.page'))
const SearchPage = lazy(() => import('./modules/explorer/pages/search.page'))
const TaskBoardPage = lazy(() => import('./modules/operations/pages/task-board.page'))
const ExportListPage = lazy(() => import('./modules/operations/pages/export-list.page'))
const RunHistoryPage = lazy(() => import('./modules/pipelines/pages/run-history.page'))
const ToolsHomePage = lazy(() => import('./modules/tools/pages/tools-home.page'))
const ToolWorkspacePage = lazy(() => import('./modules/tools/pages/tool-workspace.page'))

export const routes: RouteObject[] = [
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/catalog', element: <DatasetListPage /> },
      { path: '/catalog/:datasetId', element: <DatasetDetailPage /> },
      { path: '/explorer', element: <DistributionPage /> },
      { path: '/explorer/search', element: <SearchPage /> },
      { path: '/ops', element: <TaskBoardPage /> },
      { path: '/ops/exports', element: <ExportListPage /> },
      { path: '/pipelines', element: <RunHistoryPage /> },
      { path: '/tools', element: <ToolsHomePage /> },
      { path: '/tools/:toolId', element: <ToolWorkspacePage /> },
    ],
  },
]
