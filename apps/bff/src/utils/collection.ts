type QueryValue = string | number | undefined

type CollectionQuery = Record<string, unknown>

type CollectionQueryOptions<T extends Record<string, unknown>> = {
  query: CollectionQuery
  defaultSort?: { field: keyof T & string; order: 'asc' | 'desc' }
  filter?: (item: T) => boolean
  searchableText?: (item: T) => string
}

export type PaginationMeta = {
  total: number
  skip: number
  limit: number
}

export function applyCollectionQuery<T extends Record<string, unknown>>(
  items: T[],
  options: CollectionQueryOptions<T>,
) {
  const { filter, searchableText, query, defaultSort } = options
  const searchText = normalizeText(getStringValue(query.q))

  let filtered = filter ? items.filter(filter) : [...items]
  if (searchText && searchableText) {
    filtered = filtered.filter((item) => normalizeText(searchableText(item)).includes(searchText))
  }

  const sortConfig = resolveSortConfig<T>(query, defaultSort)
  if (sortConfig) {
    filtered.sort((left, right) =>
      compareValues(left[sortConfig.field], right[sortConfig.field], sortConfig.order as 'asc' | 'desc'),
    )
  }

  const total = filtered.length
  const skip = Math.max(0, getNumberValue(query.skip) ?? 0)
  const limit = Math.max(0, getNumberValue(query.limit) ?? total ?? 0)
  const end = limit === 0 ? total : skip + limit
  const paged = filtered.slice(skip, end)

  return {
    items: paged,
    pagination: {
      total,
      skip,
      limit: limit === 0 ? total : limit,
    } satisfies PaginationMeta,
  }
}

function resolveSortConfig<T extends Record<string, unknown>>(
  query: CollectionQuery,
  fallback?: { field: keyof T & string; order: 'asc' | 'desc' },
) {
  const sortValue = query.sort
  if (typeof sortValue === 'string') {
    try {
      const parsed = JSON.parse(sortValue) as Record<string, unknown>
      const [field, order] = Object.entries(parsed)[0] ?? []
      if (field && (order === 'asc' || order === 'desc')) {
        return { field: field as keyof T & string, order: order as 'asc' | 'desc' }
      }
    } catch {
      return fallback
    }
  }

  const sortField = getStringValue(query.sortField)
  const sortOrder = getStringValue(query.sortOrder)
  if (sortField && (sortOrder === 'asc' || sortOrder === 'desc')) {
    return { field: sortField as keyof T & string, order: sortOrder }
  }

  return fallback
}

function compareValues(left: unknown, right: unknown, order: 'asc' | 'desc') {
  const first = comparableValue(left)
  const second = comparableValue(right)
  if (first < second) {
    return order === 'asc' ? -1 : 1
  }
  if (first > second) {
    return order === 'asc' ? 1 : -1
  }
  return 0
}

function comparableValue(value: unknown) {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return value.toLowerCase()
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  return String(value ?? '')
}

function normalizeText(value: string | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function getNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function getStringValue(value: QueryValue | unknown) {
  return typeof value === 'string' ? value : undefined
}