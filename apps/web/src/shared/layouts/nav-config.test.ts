import { describe, expect, it } from 'vitest'
import { navGroups } from './nav-config'

describe('navGroups', () => {
  it('is a non-empty list of groups each with items', () => {
    expect(navGroups.length).toBeGreaterThan(0)
    for (const group of navGroups) {
      expect(group.label).toBeTruthy()
      expect(group.items.length).toBeGreaterThan(0)
      for (const item of group.items) {
        expect(item.path.startsWith('/')).toBe(true)
        expect(item.label).toBeTruthy()
      }
    }
  })

  it('exposes the Overview root route', () => {
    const overview = navGroups.find((g) => g.label === 'Overview')
    expect(overview?.items[0].path).toBe('/')
  })
})
