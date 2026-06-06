import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'
import { MainLayout } from './shared/layouts/main-layout'

const OverviewPage = lazy(() => import('./modules/overview/pages/overview.page'))
const DatasetListPage = lazy(() => import('./modules/catalog/pages/dataset-list.page'))
const DatasetDetailPage = lazy(() => import('./modules/catalog/pages/dataset-detail.page'))
const DatasetV2DetailPage = lazy(() => import('./modules/catalog/pages/dataset-v2-detail.page'))
const RequirementListPage = lazy(() => import('./modules/requirements/pages/requirement-list.page'))
const RequirementDetailPage = lazy(() => import('./modules/requirements/pages/requirement-detail.page'))
const RequirementReportPage = lazy(() => import('./modules/requirements/pages/requirement-report.page'))
const DataTaskDetailPage = lazy(() => import('./modules/requirements/pages/data-task-detail.page'))
const DistributionPage = lazy(() => import('./modules/explorer/pages/distribution.page'))
const SearchPage = lazy(() => import('./modules/explorer/pages/search.page'))
const ClipDetailPage = lazy(() => import('./modules/explorer/pages/clip-detail.page'))
const TaskBoardPage = lazy(() => import('./modules/operations/pages/task-board.page'))
const ExportListPage = lazy(() => import('./modules/operations/pages/export-list.page'))
const LabelingPage = lazy(() => import('./modules/operations/pages/labeling.page'))
const AnnotationWorkspacePage = lazy(() => import('./modules/operations/annotation/annotation-workspace.page'))
const TaggingPage = lazy(() => import('./modules/operations/pages/tagging.page'))
const CheckingPage = lazy(() => import('./modules/operations/pages/checking.page'))
const MiningPage = lazy(() => import('./modules/operations/pages/mining.page'))
const ReleasePage = lazy(() => import('./modules/operations/pages/release.page'))
const PipelinesPage = lazy(() => import('./modules/pipelines/pages/pipelines.page'))
const ExportsPage = lazy(() => import('./modules/exports/pages/exports.page'))
const ToolsHomePage = lazy(() => import('./modules/tools/pages/tools-home.page'))
const ToolWorkspacePage = lazy(() => import('./modules/tools/pages/tool-workspace.page'))
const SettingsPage = lazy(() => import('./modules/settings/pages/settings.page'))
const DocsViewerPage = lazy(() => import('./modules/docs/pages/docs-viewer.page'))

export const routes: RouteObject[] = [
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/catalog', element: <DatasetListPage /> },
      { path: '/catalog/v2/:datasetId', element: <DatasetV2DetailPage /> },
      { path: '/catalog/:datasetId', element: <DatasetDetailPage /> },
      { path: '/requirements', element: <RequirementListPage /> },
      { path: '/requirements/:id', element: <RequirementDetailPage /> },
      { path: '/requirements/:id/report', element: <RequirementReportPage /> },
      { path: '/data-tasks/:taskId', element: <DataTaskDetailPage /> },
      { path: '/explorer', element: <DistributionPage /> },
      { path: '/explorer/search', element: <SearchPage /> },
      { path: '/explorer/clips/:clipId', element: <ClipDetailPage /> },
      { path: '/ops', element: <TaskBoardPage /> },
      { path: '/ops/mining', element: <MiningPage /> },
      { path: '/ops/labeling', element: <LabelingPage /> },
      { path: '/ops/labeling/annotate', element: <AnnotationWorkspacePage /> },
      { path: '/ops/tagging', element: <TaggingPage /> },
      { path: '/ops/checking', element: <CheckingPage /> },
      { path: '/ops/release', element: <ReleasePage /> },
      { path: '/ops/exports', element: <ExportListPage /> },
      { path: '/exports', element: <ExportsPage /> },
      { path: '/pipelines', element: <PipelinesPage /> },
      { path: '/tools', element: <ToolsHomePage /> },
      { path: '/tools/:toolId', element: <ToolWorkspacePage /> },
      { path: '/settings', element: <SettingsPage /> },
      // 用单一带 splat 的 route，避免 /docs ↔ /docs/<file> 切换时组件被 remount，丢失展开态
      { path: '/docs/*', element: <DocsViewerPage /> },
    ],
  },
]
