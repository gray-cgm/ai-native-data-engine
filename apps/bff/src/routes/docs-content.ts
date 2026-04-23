import fs from 'node:fs'
import path from 'node:path'

import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

/**
 * Locate the repository root by walking up from the process cwd until we
 * find a `docs/` directory next to `pnpm-workspace.yaml` (or just a
 * `docs/` directory if the workspace marker is missing).
 */
function resolveDocsRoot(): string {
  const envOverride = process.env.DOCS_ROOT_DIR
  if (envOverride) {
    const abs = path.resolve(envOverride)
    if (fs.existsSync(abs)) {
      return abs
    }
  }
  let current = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, 'docs')
    const marker = path.join(current, 'pnpm-workspace.yaml')
    if (fs.existsSync(candidate) && fs.existsSync(marker)) {
      return candidate
    }
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
  // Fallback: first `docs/` we see while walking up.
  current = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, 'docs')
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate
    }
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
  return path.resolve(process.cwd(), 'docs')
}

const DOCS_ROOT = resolveDocsRoot()

const ALLOWED_EXT = new Set(['.md', '.markdown'])
const IGNORED_DIR_NAMES = new Set(['.ipynb_checkpoints', 'assets', 'node_modules', '.git'])

type DocFileNode = {
  type: 'file'
  name: string
  title: string
  path: string // relative to DOCS_ROOT, POSIX-style
}

type DocDirNode = {
  type: 'dir'
  name: string
  path: string
  children: DocNode[]
}

type DocNode = DocFileNode | DocDirNode

function toRelPosix(absPath: string) {
  const rel = path.relative(DOCS_ROOT, absPath)
  return rel.split(path.sep).join('/')
}

function extractTitle(absPath: string, fallback: string): string {
  try {
    // Read a small prefix, enough to capture the first H1 heading.
    const fd = fs.openSync(absPath, 'r')
    const buffer = Buffer.alloc(4096)
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0)
    fs.closeSync(fd)
    const content = buffer.subarray(0, bytes).toString('utf8')
    const match = content.match(/^\s*#\s+(.+?)\s*$/m)
    if (match) {
      return match[1].trim()
    }
  } catch {
    // ignore
  }
  return fallback
}

function buildTree(dir: string): DocNode[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const dirs: DocDirNode[] = []
  const files: DocFileNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue
      const children = buildTree(absPath)
      if (children.length === 0) continue
      dirs.push({
        type: 'dir',
        name: entry.name,
        path: toRelPosix(absPath),
        children,
      })
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (!ALLOWED_EXT.has(ext)) continue
      const baseName = entry.name.replace(/\.(md|markdown)$/i, '')
      files.push({
        type: 'file',
        name: entry.name,
        title: extractTitle(absPath, baseName),
        path: toRelPosix(absPath),
      })
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.title.localeCompare(b.title))
  return [...dirs, ...files]
}

function resolveSafeFilePath(rawPath: string): string | null {
  const normalized = rawPath.replaceAll('\\', '/').replace(/^\/+/, '')
  if (!normalized) return null
  if (normalized.includes('\0')) return null
  const absPath = path.resolve(DOCS_ROOT, normalized)
  const rel = path.relative(DOCS_ROOT, absPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  const ext = path.extname(absPath).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) return null
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null
  return absPath
}

const treeRoute = defineRoute({
  method: 'get',
  path: '/docs/tree',
  validate: {
    output: buildOutputSchema(
      Joi.object({
        root: Joi.string().required(),
        nodes: Joi.array().required(),
      }),
    ),
  },
  meta: {
    swagger: {
      summary: '获取 /docs 目录的文档树',
      tags: ['docs-content'],
    },
  },
  handler: async (ctx) => {
    try {
      const nodes = buildTree(DOCS_ROOT)
      ctx.body = {
        root: DOCS_ROOT,
        nodes,
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        root: DOCS_ROOT,
        nodes: [],
        error: (error as Error).message,
      }
    }
  },
})

const fileRoute = defineRoute({
  method: 'get',
  path: '/docs/file',
  validate: {
    query: Joi.object({
      path: Joi.string().required(),
    }),
    output: buildOutputSchema(
      Joi.object({
        path: Joi.string().required(),
        title: Joi.string().allow('').required(),
        content: Joi.string().allow('').required(),
        size: Joi.number().required(),
        updated_at: Joi.string().required(),
      }),
    ),
  },
  meta: {
    swagger: {
      summary: '读取指定 Markdown 文档内容',
      tags: ['docs-content'],
    },
  },
  handler: async (ctx) => {
    const rawPath = String((ctx.request.query as Record<string, string>)?.path ?? '')
    const absPath = resolveSafeFilePath(rawPath)
    if (!absPath) {
      ctx.status = 404
      ctx.body = { message: 'document not found' }
      return
    }
    const stat = fs.statSync(absPath)
    const content = fs.readFileSync(absPath, 'utf8')
    const baseName = path.basename(absPath).replace(/\.(md|markdown)$/i, '')
    const title = extractTitle(absPath, baseName)
    ctx.body = {
      path: toRelPosix(absPath),
      title,
      content,
      size: stat.size,
      updated_at: stat.mtime.toISOString(),
    }
  },
})

export default [treeRoute, fileRoute]
