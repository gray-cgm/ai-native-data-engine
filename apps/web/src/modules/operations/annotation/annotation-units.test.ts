import { afterEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock('@/shared/api/client', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
}))

import {
  ALL_TOOLS,
  ANNOTATION_TOOLS,
  DEFAULT_PRIMARY_TOOL,
  NAVIGATION_TOOLS,
  TOOL_CLASSES,
} from './tools'
import { loadAnnotations, saveAnnotations } from './annotation-api'
import { toWebImageId } from './web-image-loader'

afterEach(() => vi.clearAllMocks())

describe('annotation tool catalog', () => {
  it('exposes annotation + navigation tools with unique names', () => {
    expect(ANNOTATION_TOOLS.length).toBeGreaterThan(0)
    expect(NAVIGATION_TOOLS.length).toBeGreaterThan(0)
    expect(ALL_TOOLS).toHaveLength(ANNOTATION_TOOLS.length + NAVIGATION_TOOLS.length)
    const names = ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
  it('every annotation tool is category=annotation and carries an icon', () => {
    for (const t of ANNOTATION_TOOLS) {
      expect(t.category).toBe('annotation')
      expect(t.icon).toBeTruthy()
    }
  })
  it('TOOL_CLASSES matches the tool count and DEFAULT_PRIMARY_TOOL is an annotation tool', () => {
    expect(TOOL_CLASSES.length).toBe(ALL_TOOLS.length)
    expect(ANNOTATION_TOOLS.some((t) => t.name === DEFAULT_PRIMARY_TOOL)).toBe(true)
  })
})

describe('annotation-api', () => {
  it('saveAnnotations posts the payload', async () => {
    apiPost.mockResolvedValue({ event: {}, ops_item: null })
    const body = { clip_id: 'c1', annotations: [] }
    await saveAnnotations(body)
    expect(apiPost).toHaveBeenCalledWith('/ops/labeling/annotations', body)
  })
  it('loadAnnotations builds query with optional trace', async () => {
    apiGet.mockResolvedValue({ clip_id: 'c1', event: null })
    await loadAnnotations('c1')
    expect(apiGet).toHaveBeenCalledWith('/ops/labeling/annotations?clip_id=c1')
    await loadAnnotations('c1', 'trace-1')
    expect(apiGet).toHaveBeenLastCalledWith('/ops/labeling/annotations?clip_id=c1&x_trace_id=trace-1')
  })
})

describe('toWebImageId', () => {
  it('prefixes raw urls and is idempotent', () => {
    expect(toWebImageId('http://x/a.png')).toBe('web:http://x/a.png')
    expect(toWebImageId('web:http://x/a.png')).toBe('web:http://x/a.png')
  })
})
