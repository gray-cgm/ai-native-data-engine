import { useEffect, useMemo, useState } from 'react'

type DistributionRow = { scene: string; sample_count: number }
type DatasetVersion = { version_id: string; dataset_id: string; sample_count: number; table_name: string }
type DatasetItem = { dataset_id: string; name: string; workspace_id: string; profile: string }
type TaskItem = { task_id: string; title: string; status: string; task_type: string }
type WorkspaceItem = { workspace_id: string; name: string }
type ExportItem = { export_id: string; dataset_id: string; format: string; status: string; output_path: string }
type SearchRow = { id: string; scene: string; dataset_version_id?: string }

const API_BASE = 'http://localhost:3100/api'

export function DashboardPage() {
  const [keyword, setKeyword] = useState('')
  const [distribution, setDistribution] = useState<DistributionRow[]>([])
  const [datasets, setDatasets] = useState<DatasetItem[]>([])
  const [datasetVersions, setDatasetVersions] = useState<Record<string, DatasetVersion[]>>({})
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [exports, setExports] = useState<ExportItem[]>([])
  const [searchRows, setSearchRows] = useState<SearchRow[]>([])
  const [loading, setLoading] = useState(true)

  async function refreshData() {
    const payload = await fetch(`${API_BASE}/dashboard`).then((r) => r.json())
    setDistribution(payload.distribution ?? [])
    setDatasets(payload.datasets ?? [])
    setDatasetVersions(payload.datasetVersions ?? {})
    setTasks(payload.tasks ?? [])
    setWorkspaces(payload.workspaces ?? [])
    setExports(payload.exports ?? [])
    setSearchRows(payload.searchRows ?? [])
  }

  useEffect(() => {
    async function bootstrap() {
      await fetch(`${API_BASE}/bootstrap`, { method: 'POST' })
      await refreshData()
      setLoading(false)
    }
    bootstrap().catch(() => setLoading(false))
  }, [])

  async function handleExport(datasetId: string) {
    await fetch(`${API_BASE}/datasets/${datasetId}/exports`, { method: 'POST' })
    await refreshData()
  }

  const filteredSearchRows = useMemo(() => {
    return searchRows.filter((item) => {
      const text = `${item.id} ${item.scene}`.toLowerCase()
      return text.includes(keyword.toLowerCase())
    })
  }, [keyword, searchRows])

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>AD Data Workbench</h1>
        <nav>
          <a href="#overview">Overview</a>
          <a href="#datasets">Datasets</a>
          <a href="#search">Search</a>
          <a href="#tasks">Tasks</a>
          <a href="#workspace">Workspace</a>
          <a href="#exports">Exports</a>
        </nav>
      </aside>
      <main className="content">
        <section className="hero" id="overview">
          <div className="card">
            <h2>本地 DataLake 工作台</h2>
            <p>围绕统一数据资产模型，提供数据导入、资产物化、DuckDB 查询、基础检索、数据导出。</p>
            <div className="stats">
              <div><strong>{datasets.length}</strong><span>Datasets</span></div>
              <div><strong>{tasks.length}</strong><span>Tasks</span></div>
              <div><strong>{distribution.reduce((sum, row) => sum + row.sample_count, 0)}</strong><span>Samples</span></div>
              <div><strong>{exports.length}</strong><span>Exports</span></div>
            </div>
          </div>
        </section>

        <section className="grid-two" id="datasets">
          <div className="card">
            <h3>Datasets</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Workspace</th>
                  <th>Profile</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((item) => (
                  <tr key={item.dataset_id}>
                    <td>{item.dataset_id}</td>
                    <td>{item.name}</td>
                    <td>{item.workspace_id}</td>
                    <td>{item.profile}</td>
                    <td>
                      <button onClick={() => handleExport(item.dataset_id)}>Export</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Data Distribution</h3>
            <table>
              <thead>
                <tr>
                  <th>Scene</th>
                  <th>Sample Count</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map((row) => (
                  <tr key={row.scene}>
                    <td>{row.scene}</td>
                    <td>{row.sample_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid-two">
          <div className="card">
            <h3>Dataset Versions</h3>
            <table>
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Version</th>
                  <th>Samples</th>
                  <th>Table</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(datasetVersions).flatMap(([datasetId, versions]) =>
                  versions.map((version) => (
                    <tr key={`${datasetId}-${version.version_id}`}>
                      <td>{datasetId}</td>
                      <td>{version.version_id}</td>
                      <td>{version.sample_count}</td>
                      <td>{version.table_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card" id="search">
            <h3>Search Preview</h3>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索样本 / 场景"
            />
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Scene</th>
                </tr>
              </thead>
              <tbody>
                {filteredSearchRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.scene}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid-two" id="tasks">
          <div className="card">
            <h3>Tasks</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((item) => (
                  <tr key={item.task_id}>
                    <td>{item.task_id}</td>
                    <td>{item.title}</td>
                    <td>{item.task_type}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" id="workspace">
            <h3>Workspaces</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((item) => (
                  <tr key={item.workspace_id}>
                    <td>{item.workspace_id}</td>
                    <td>{item.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid-two">
          <div className="card">
            <h3>Labeling Domain Demo</h3>
            <ul>
              <li>保留 labeling task domain，不实现完整标注系统</li>
              <li>挖掘结果可进入任务队列</li>
              <li>当前以 demo task 展示最小流程</li>
            </ul>
          </div>

          <div className="card" id="exports">
            <h3>Exports</h3>
            {loading ? <p>Loading...</p> : null}
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Dataset</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((item) => (
                  <tr key={item.export_id}>
                    <td>{item.export_id}</td>
                    <td>{item.dataset_id}</td>
                    <td>{item.format}</td>
                    <td>{item.status}</td>
                    <td>{item.output_path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
