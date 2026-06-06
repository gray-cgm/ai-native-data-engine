import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  ClipResultTable,
  ClipResultWall,
  formatDuration,
  formatTimestamp,
  splitTags,
} from './components/clip-result-views'
import type { ClipSummary } from './clips-api'

function clip(over: Partial<ClipSummary> = {}): ClipSummary {
  return {
    clip_id: 'clip-1',
    keyframe_count: 12,
    start_time: 1_000_000_000,
    end_time: 6_000_000_000,
    duration_seconds: 95,
    vehicle_name: 'veh',
    city: 'SF',
    district: 'd',
    scenario: 'night',
    tags: 'rain, fog',
    da_tags: null,
    topics: [],
    cameras: [],
    standalone_topics: [],
    has_wm: false,
    ...over,
  }
}

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(95)).toBe('1m 35s')
    expect(formatDuration(null)).toBe('—')
  })
})

describe('formatTimestamp', () => {
  it('renders dash for missing', () => {
    expect(formatTimestamp(null)).toBe('—')
    expect(formatTimestamp(0)).toBe('—')
  })
  it('renders a date string for a ns value', () => {
    expect(formatTimestamp(1_700_000_000_000_000)).not.toBe('—')
  })
})

describe('splitTags', () => {
  it('splits, trims, and drops empties', () => {
    expect(splitTags('a, b ,, c')).toEqual(['a', 'b', 'c'])
    expect(splitTags(null)).toEqual([])
  })
})

describe('ClipResultTable / ClipResultWall', () => {
  it('renders clip rows in the table', () => {
    render(
      <MemoryRouter>
        <ClipResultTable items={[clip()]} emptyText="No clips" detailHref={(c) => `/clip/${c.clip_id}`} />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/clip-1/).length).toBeGreaterThan(0)
  })

  it('renders empty text when no items', () => {
    render(
      <MemoryRouter>
        <ClipResultWall items={[]} emptyText="No clips" detailHref={() => '#'} />
      </MemoryRouter>,
    )
    expect(screen.getByText('No clips')).toBeInTheDocument()
  })
})
