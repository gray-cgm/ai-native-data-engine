import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Empty, Input, Spin, Tag, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import {
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  BookOutlined,
  RocketOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  CompassOutlined,
  ApiOutlined,
  ReadOutlined,
  HistoryOutlined,
  EllipsisOutlined,
} from '@ant-design/icons'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

import { useQuery } from '@/shared/hooks/use-query'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import {
  buildCuratedView,
  fetchDocFile,
  fetchDocTree,
  type CuratedGroup,
  type CuratedItem,
  type CuratedSection,
  type DocFileNode,
} from '../api'
import { MermaidBlock } from '../components/mermaid-block'
import '../docs-viewer.css'

const { Title, Text } = Typography

const SECTION_ICONS: Record<CuratedSection['icon'], React.ReactNode> = {
  rocket: <RocketOutlined />,
  product: <AppstoreOutlined />,
  architecture: <ApartmentOutlined />,
  adr: <CompassOutlined />,
  api: <ApiOutlined />,
  reading: <ReadOutlined />,
  devlog: <HistoryOutlined />,
  other: <EllipsisOutlined />,
}

function itemNode(item: CuratedItem): DataNode {
  return {
    key: `file:${item.path}`,
    title: (
      <span className={item.present ? '' : 'docs-viewer__missing'}>
        <FileTextOutlined style={{ marginRight: 6, color: '#6c7a89' }} />
        {item.title}
        {!item.present && <Tag style={{ marginLeft: 8 }} color="warning">缺失</Tag>}
        {item.hint && <span className="docs-viewer__hint">· {item.hint}</span>}
      </span>
    ),
    isLeaf: true,
    disabled: !item.present,
  }
}

function groupNode(group: CuratedGroup): DataNode {
  const children: DataNode[] = [
    ...group.groups.map(groupNode),
    ...group.items.map(itemNode),
  ]
  return {
    key: `group:${group.id}`,
    title: (
      <span>
        <FolderOutlined style={{ marginRight: 6, color: '#b08b58' }} />
        {group.label}
      </span>
    ),
    selectable: false,
    children,
  }
}

function sectionNode(section: CuratedSection): DataNode {
  const children: DataNode[] = [
    ...section.groups.map(groupNode),
    ...section.items.map(itemNode),
  ]
  return {
    key: `section:${section.id}`,
    title: (
      <span className="docs-viewer__section-title">
        <span className="docs-viewer__section-icon">{SECTION_ICONS[section.icon]}</span>
        <span className="docs-viewer__section-label">{section.label}</span>
        <Tag style={{ marginLeft: 8 }} color="blue">{section.fileCount}</Tag>
      </span>
    ),
    selectable: false,
    children,
  }
}

function orphanSectionNode(files: DocFileNode[]): DataNode {
  return {
    key: 'section:__orphan__',
    title: (
      <span className="docs-viewer__section-title">
        <span className="docs-viewer__section-icon">{SECTION_ICONS.other}</span>
        <span className="docs-viewer__section-label">📂 其他文档</span>
        <Tag style={{ marginLeft: 8 }} color="default">{files.length}</Tag>
      </span>
    ),
    selectable: false,
    children: files.map((f) =>
      itemNode({ path: f.path, title: f.title, present: true }),
    ),
  }
}

function filterItems(items: CuratedItem[], kw: string): CuratedItem[] {
  return items.filter(
    (it) =>
      it.title.toLowerCase().includes(kw) ||
      it.path.toLowerCase().includes(kw) ||
      (it.hint?.toLowerCase().includes(kw) ?? false),
  )
}

function filterGroup(group: CuratedGroup, kw: string): CuratedGroup | null {
  const items = filterItems(group.items, kw)
  const groups = group.groups.map((g) => filterGroup(g, kw)).filter((g): g is CuratedGroup => !!g)
  if (items.length === 0 && groups.length === 0 && !group.label.toLowerCase().includes(kw)) {
    return null
  }
  return { ...group, items, groups }
}

function filterSection(section: CuratedSection, kw: string): CuratedSection | null {
  const items = filterItems(section.items, kw)
  const groups = section.groups.map((g) => filterGroup(g, kw)).filter((g): g is CuratedGroup => !!g)
  if (
    items.length === 0 &&
    groups.length === 0 &&
    !section.label.toLowerCase().includes(kw) &&
    !(section.description ?? '').toLowerCase().includes(kw)
  ) {
    return null
  }
  const fileCount = items.filter((it) => it.present).length +
    groups.reduce((acc, g) => acc + countPresent(g), 0)
  return { ...section, items, groups, fileCount }
}

function countPresent(group: CuratedGroup): number {
  let n = group.items.filter((it) => it.present).length
  for (const g of group.groups) n += countPresent(g)
  return n
}

function collectSectionKeys(section: CuratedSection): string[] {
  const keys = [`section:${section.id}`]
  for (const g of section.groups) keys.push(...collectGroupKeys(g))
  return keys
}

function collectGroupKeys(group: CuratedGroup): string[] {
  const keys = [`group:${group.id}`]
  for (const g of group.groups) keys.push(...collectGroupKeys(g))
  return keys
}

function stripDuplicateH1(content: string, title: string): string {
  const lines = content.split('\n')
  let i = 0
  if (lines[0]?.trim() === '---') {
    let j = 1
    while (j < lines.length && lines[j].trim() !== '---') j++
    if (j < lines.length) i = j + 1
  }
  while (i < lines.length && lines[i].trim() === '') i++
  const m = /^#\s+(.+?)\s*$/.exec(lines[i] ?? '')
  if (!m) return content
  if (m[1].trim() !== title.trim()) return content
  lines.splice(i, 1)
  while (i < lines.length && lines[i].trim() === '') lines.splice(i, 1)
  return lines.join('\n')
}

const markdownComponents: Components = {
  code({ className, children, ...rest }) {
    const content = String(children ?? '').replace(/\n$/, '')
    const isBlock = (rest as { node?: { position?: { start: { line: number }; end: { line: number } } } }).node
      ? true
      : (className ?? '').includes('language-')
    const match = /language-(\w+)/.exec(className ?? '')
    const lang = match?.[1]
    if (isBlock && lang === 'mermaid') {
      return <MermaidBlock code={content} />
    }
    if (isBlock) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    )
  },
}

export default function DocsViewerPage() {
  const navigate = useNavigate()
  const params = useParams()
  const splat = (params['*'] ?? '').trim()
  const activePath = splat ? decodeURIComponent(splat) : ''

  const [keyword, setKeyword] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [defaultExpanded, setDefaultExpanded] = useState(false)

  const treeFetcher = useCallback(() => fetchDocTree(), [])
  const {
    data: treeData,
    state: treeState,
    error: treeError,
    refetch: refetchTree,
  } = useQuery(treeFetcher, { cacheKey: 'docs:tree' })

  const curated = useMemo(() => (treeData ? buildCuratedView(treeData) : null), [treeData])

  // Default: expand top-level sections and the first section's subgroups.
  useEffect(() => {
    if (!curated || defaultExpanded) return
    const keys: string[] = curated.sections.map((s) => `section:${s.id}`)
    if (curated.sections[0]) {
      for (const g of curated.sections[0].groups) {
        keys.push(...collectGroupKeys(g))
      }
    }
    if (curated.orphanFiles.length > 0) keys.push('section:__orphan__')
    setExpandedKeys(keys)
    setDefaultExpanded(true)
    // auto-open first available file
    if (!activePath) {
      const first =
        curated.sections.flatMap((s) => [
          ...s.items,
          ...s.groups.flatMap((g) => [...g.items, ...g.groups.flatMap((gg) => gg.items)]),
        ]).find((it) => it.present) ||
        (curated.orphanFiles[0]
          ? { path: curated.orphanFiles[0].path, title: curated.orphanFiles[0].title, present: true }
          : null)
      if (first) {
        navigate(`/docs/${encodeURI(first.path)}`, { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curated])

  // When searching, expand all matching sections so hits are visible.
  const filtered = useMemo(() => {
    if (!curated) return null
    const kw = keyword.trim().toLowerCase()
    if (!kw) return curated
    const sections = curated.sections
      .map((s) => filterSection(s, kw))
      .filter((s): s is CuratedSection => !!s)
    const orphanFiles = curated.orphanFiles.filter(
      (f) =>
        f.title.toLowerCase().includes(kw) ||
        f.path.toLowerCase().includes(kw) ||
        f.name.toLowerCase().includes(kw),
    )
    return { sections, orphanFiles }
  }, [curated, keyword])

  useEffect(() => {
    if (!filtered) return
    if (!keyword.trim()) return
    const keys: string[] = []
    for (const s of filtered.sections) keys.push(...collectSectionKeys(s))
    if (filtered.orphanFiles.length > 0) keys.push('section:__orphan__')
    setExpandedKeys(keys)
  }, [keyword, filtered])

  const antdTreeData = useMemo<DataNode[]>(() => {
    if (!filtered) return []
    const nodes = filtered.sections.map(sectionNode)
    if (filtered.orphanFiles.length > 0) nodes.push(orphanSectionNode(filtered.orphanFiles))
    return nodes
  }, [filtered])

  const fileFetcher = useCallback(
    () => (activePath ? fetchDocFile(activePath) : Promise.resolve(null as never)),
    [activePath],
  )
  const {
    data: fileData,
    state: fileState,
    error: fileError,
    refetch: refetchFile,
  } = useQuery(fileFetcher)

  const handleSelect = (keys: React.Key[]) => {
    const key = keys[0]
    if (typeof key !== 'string' || !key.startsWith('file:')) return
    const filePath = key.slice('file:'.length)
    navigate(`/docs/${encodeURI(filePath)}`)
  }

  const totalFiles = useMemo(() => {
    if (!curated) return 0
    return (
      curated.sections.reduce((acc, s) => acc + s.fileCount, 0) +
      curated.orphanFiles.length
    )
  }, [curated])

  return (
    <div className="docs-viewer">
      <aside className="docs-viewer__sidebar">
        <div className="docs-viewer__sidebar-header">
          <div className="docs-viewer__sidebar-title">
            <BookOutlined style={{ marginRight: 8 }} />
            文档中心
          </div>
          <div className="docs-viewer__sidebar-sub">
            {totalFiles > 0 ? `共 ${totalFiles} 篇 · 按主题组织` : '面向开发者与用户的产品与架构文档'}
          </div>
        </div>
        <div className="docs-viewer__sidebar-search">
          <Input.Search
            placeholder="搜索标题、路径或主题"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div className="docs-viewer__tree">
          {treeState === 'loading' && <Spin />}
          {treeState === 'error' && (
            <PageError message={treeError?.message} onRetry={() => { void refetchTree() }} />
          )}
          {treeState !== 'loading' && treeState !== 'error' && (
            antdTreeData.length > 0 ? (
              <Tree
                treeData={antdTreeData}
                showIcon={false}
                switcherIcon={({ expanded }) => (expanded ? <FolderOpenOutlined /> : <FolderOutlined />)}
                expandedKeys={expandedKeys}
                onExpand={setExpandedKeys}
                selectedKeys={activePath ? [`file:${activePath}`] : []}
                onSelect={handleSelect}
                blockNode
              />
            ) : (
              <Empty description="未找到匹配的文档" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )
          )}
        </div>
      </aside>

      <section className="docs-viewer__main">
        <div className="docs-viewer__article">
          {!activePath && (
            <div className="docs-viewer__empty">
              <Empty description="请在左侧选择一篇文档" />
            </div>
          )}
          {activePath && fileState === 'loading' && <PageLoading />}
          {activePath && fileState === 'error' && (
            <PageError message={fileError?.message} onRetry={() => { void refetchFile() }} />
          )}
          {activePath && fileData && (fileState === 'ready' || fileState === 'empty') && (
            <>
              <Title level={2} style={{ marginTop: 0 }}>{fileData.title}</Title>
              <div className="docs-viewer__meta">
                <Text type="secondary">路径：/docs/{fileData.path}</Text>
                <Text type="secondary">更新：{new Date(fileData.updated_at).toLocaleString()}</Text>
                <Text type="secondary">{(fileData.size / 1024).toFixed(1)} KB</Text>
              </div>
              <article className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                  components={markdownComponents}
                >
                  {stripDuplicateH1(fileData.content, fileData.title)}
                </ReactMarkdown>
              </article>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
