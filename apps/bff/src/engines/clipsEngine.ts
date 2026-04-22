import type { ClipSummary } from '../types.js'
import { applyCollectionQuery } from '../utils/collection.js'
import { listClips } from '../services/clips.js'

type Query = Record<string, unknown>

export async function queryClips(query: Query) {
  const response = await listClips()
  const items = response.items ?? []
  return applyCollectionQuery<ClipSummary>(items, {
    query,
    defaultSort: { field: 'start_time', order: 'desc' },
    searchableText: (item) =>
      [
        item.clip_id,
        item.vehicle_name ?? '',
        item.city ?? '',
        item.district ?? '',
        item.scenario ?? '',
        item.tags ?? '',
        item.da_tags ?? '',
      ].join(' '),
  })
}
