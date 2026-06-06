import { describe, expect, it } from 'vitest'

import { applyCollectionQuery } from '../../src/utils/collection.js'
import { removeUndefinedKeys } from '../../src/utils/object.js'

type Row = Record<string, unknown> & { id: string; name: string; n: number }

const rows: Row[] = [
  { id: 'a', name: 'Banana', n: 3 },
  { id: 'b', name: 'apple', n: 1 },
  { id: 'c', name: 'Cherry', n: 2 },
]

describe('removeUndefinedKeys', () => {
  it('drops only undefined values, keeps null/0/false/""', () => {
    const result = removeUndefinedKeys({ a: undefined, b: null, c: 0, d: false, e: '' })
    expect(result).toEqual({ b: null, c: 0, d: false, e: '' })
  })
})

describe('applyCollectionQuery', () => {
  it('applies default sort ascending', () => {
    const { items, pagination } = applyCollectionQuery(rows, {
      query: {},
      defaultSort: { field: 'name', order: 'asc' },
    })
    expect(items.map((r) => r.id)).toEqual(['b', 'a', 'c'])
    expect(pagination).toEqual({ total: 3, skip: 0, limit: 3 })
  })

  it('respects explicit sort JSON over default', () => {
    const { items } = applyCollectionQuery(rows, {
      query: { sort: JSON.stringify({ n: 'desc' }) },
    })
    expect(items.map((r) => r.n)).toEqual([3, 2, 1])
  })

  it('falls back to default sort when sort JSON is invalid', () => {
    const { items } = applyCollectionQuery(rows, {
      query: { sort: 'not-json' },
      defaultSort: { field: 'n', order: 'asc' },
    })
    expect(items.map((r) => r.n)).toEqual([1, 2, 3])
  })

  it('supports sortField/sortOrder query form', () => {
    const { items } = applyCollectionQuery(rows, {
      query: { sortField: 'n', sortOrder: 'desc' },
    })
    expect(items.map((r) => r.n)).toEqual([3, 2, 1])
  })

  it('filters via predicate and searchableText (case-insensitive)', () => {
    const { items, pagination } = applyCollectionQuery(rows, {
      query: { q: 'APP' },
      searchableText: (item) => item.name,
    })
    expect(items.map((r) => r.id)).toEqual(['b'])
    expect(pagination.total).toBe(1)
  })

  it('applies custom filter before search', () => {
    const { items } = applyCollectionQuery(rows, {
      query: {},
      filter: (item) => item.n >= 2,
      defaultSort: { field: 'n', order: 'asc' },
    })
    expect(items.map((r) => r.n)).toEqual([2, 3])
  })

  it('paginates with skip/limit and reports total', () => {
    const { items, pagination } = applyCollectionQuery(rows, {
      query: { skip: '1', limit: '1' },
      defaultSort: { field: 'n', order: 'asc' },
    })
    expect(items.map((r) => r.n)).toEqual([2])
    expect(pagination).toEqual({ total: 3, skip: 1, limit: 1 })
  })

  it('treats limit=0 as "all remaining"', () => {
    const { items, pagination } = applyCollectionQuery(rows, {
      query: { limit: '0' },
    })
    expect(items).toHaveLength(3)
    expect(pagination.limit).toBe(3)
  })
})
