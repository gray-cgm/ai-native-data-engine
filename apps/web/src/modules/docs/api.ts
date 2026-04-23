import { apiGet } from '@/shared/api/client'
import { DOC_SECTIONS, type DocManifestGroup, type DocManifestSection } from './manifest'

export type DocFileNode = {
  type: 'file'
  name: string
  title: string
  path: string
}

export type DocDirNode = {
  type: 'dir'
  name: string
  path: string
  children: DocNode[]
}

export type DocNode = DocFileNode | DocDirNode

export type DocTree = {
  root: string
  nodes: DocNode[]
}

export type DocFile = {
  path: string
  title: string
  content: string
  size: number
  updated_at: string
}

export async function fetchDocTree(): Promise<DocTree> {
  return apiGet<DocTree>('/docs/tree')
}

export async function fetchDocFile(relPath: string): Promise<DocFile> {
  const query = new URLSearchParams({ path: relPath }).toString()
  return apiGet<DocFile>(`/docs/file?${query}`)
}

export function flattenFiles(nodes: DocNode[]): DocFileNode[] {
  const out: DocFileNode[] = []
  for (const node of nodes) {
    if (node.type === 'file') {
      out.push(node)
    } else {
      out.push(...flattenFiles(node.children))
    }
  }
  return out
}

/**
 * Curated section view — composes the flat file list into the manifest.
 */

export type CuratedItem = {
  path: string
  title: string
  hint?: string
  /** True if the file exists on disk. */
  present: boolean
}

export type CuratedGroup = {
  id: string
  label: string
  items: CuratedItem[]
  groups: CuratedGroup[]
}

export type CuratedSection = {
  id: string
  label: string
  icon: DocManifestSection['icon']
  description?: string
  items: CuratedItem[]
  groups: CuratedGroup[]
  fileCount: number
}

export type CuratedView = {
  sections: CuratedSection[]
  /** Files that exist on disk but are not referenced by the manifest. */
  orphanFiles: DocFileNode[]
}

export function buildCuratedView(tree: DocTree): CuratedView {
  const files = flattenFiles(tree.nodes)
  const byPath = new Map<string, DocFileNode>()
  for (const f of files) byPath.set(f.path, f)

  const usedPaths = new Set<string>()

  function mapItem(path: string, titleOverride?: string, hint?: string): CuratedItem {
    const f = byPath.get(path)
    if (f) usedPaths.add(path)
    return {
      path,
      title: titleOverride || f?.title || path.split('/').pop() || path,
      hint,
      present: Boolean(f),
    }
  }

  function mapGroup(g: DocManifestGroup): CuratedGroup {
    return {
      id: g.id,
      label: g.label,
      items: (g.items ?? []).map((it) => mapItem(it.path, it.title, it.hint)),
      groups: (g.groups ?? []).map(mapGroup),
    }
  }

  function countFiles(group: { items: CuratedItem[]; groups: CuratedGroup[] }): number {
    let n = group.items.filter((it) => it.present).length
    for (const g of group.groups) n += countFiles(g)
    return n
  }

  const sections: CuratedSection[] = DOC_SECTIONS.map((s) => {
    const items = (s.items ?? []).map((it) => mapItem(it.path, it.title, it.hint))
    const groups = (s.groups ?? []).map(mapGroup)
    const base = { items, groups }
    return {
      id: s.id,
      label: s.label,
      icon: s.icon,
      description: s.description,
      items,
      groups,
      fileCount: countFiles(base),
    }
  })

  const orphanFiles = files.filter((f) => !usedPaths.has(f.path))
  return { sections, orphanFiles }
}
