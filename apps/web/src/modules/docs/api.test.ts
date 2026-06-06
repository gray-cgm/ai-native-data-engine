import { describe, expect, it, vi, afterEach } from 'vitest'
import { buildCuratedView, fetchDocFile, fetchDocTree, flattenFiles, type DocNode, type DocTree } from './api'
import { DOC_SECTIONS } from './manifest'

vi.mock('@/shared/api/client', () => ({
  apiGet: vi.fn((path: string) => Promise.resolve({ path })),
}))
import { apiGet } from '@/shared/api/client'

const nodes: DocNode[] = [
  { type: 'file', name: 'a.md', title: 'A', path: 'a.md' },
  {
    type: 'dir',
    name: 'sub',
    path: 'sub',
    children: [
      { type: 'file', name: 'b.md', title: 'B', path: 'sub/b.md' },
      {
        type: 'dir',
        name: 'deep',
        path: 'sub/deep',
        children: [{ type: 'file', name: 'c.md', title: 'C', path: 'sub/deep/c.md' }],
      },
    ],
  },
]

describe('flattenFiles', () => {
  it('recursively collects only file nodes', () => {
    const files = flattenFiles(nodes)
    expect(files.map((f) => f.path)).toEqual(['a.md', 'sub/b.md', 'sub/deep/c.md'])
  })
  it('handles empty input', () => {
    expect(flattenFiles([])).toEqual([])
  })
})

function firstManifestPath(): string | undefined {
  for (const s of DOC_SECTIONS) {
    if (s.items?.[0]) return s.items[0].path
    for (const g of s.groups ?? []) {
      if (g.items?.[0]) return g.items[0].path
    }
  }
  return undefined
}

describe('buildCuratedView', () => {
  it('marks manifest items present when files exist, others absent', () => {
    const known = firstManifestPath()
    const tree: DocTree = {
      root: '/docs',
      nodes: [
        ...(known ? [{ type: 'file' as const, name: 'k', title: 'Known', path: known }] : []),
        { type: 'file', name: 'orphan', title: 'Orphan', path: 'totally/orphan-file.md' },
      ],
    }
    const view = buildCuratedView(tree)

    expect(view.sections.length).toBe(DOC_SECTIONS.length)
    // every section carries an icon and a numeric file count
    for (const s of view.sections) {
      expect(typeof s.fileCount).toBe('number')
      expect(s.icon).toBeTruthy()
    }
    // the unreferenced file shows up as orphan
    expect(view.orphanFiles.some((f) => f.path === 'totally/orphan-file.md')).toBe(true)

    if (known) {
      const total = view.sections.reduce((n, s) => n + s.fileCount, 0)
      expect(total).toBeGreaterThanOrEqual(1)
    }
  })

  it('produces empty counts when tree has no manifest files', () => {
    const view = buildCuratedView({ root: '/docs', nodes: [] })
    const total = view.sections.reduce((n, s) => n + s.fileCount, 0)
    expect(total).toBe(0)
    expect(view.orphanFiles).toEqual([])
  })
})

describe('doc fetchers', () => {
  afterEach(() => vi.clearAllMocks())
  it('fetchDocTree hits /docs/tree', async () => {
    await fetchDocTree()
    expect(apiGet).toHaveBeenCalledWith('/docs/tree')
  })
  it('fetchDocFile encodes the path query', async () => {
    await fetchDocFile('a b/c.md')
    expect(apiGet).toHaveBeenCalledWith('/docs/file?path=a+b%2Fc.md')
  })
})
