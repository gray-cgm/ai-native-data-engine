import { describe, expect, it } from 'vitest'
import { getToolById, getToolEmbedUrl, toolRegistry } from './registry'

describe('toolRegistry', () => {
  it('contains the four known tools', () => {
    expect(toolRegistry.map((t) => t.id).sort()).toEqual(['dagster', 'jupyter', 'kafka-ui', 'superset'])
  })

  it('getToolById finds and misses', () => {
    expect(getToolById('superset')?.shortName).toBe('Superset')
    expect(getToolById('nope')).toBeUndefined()
    expect(getToolById()).toBeUndefined()
  })

  it('getToolEmbedUrl picks gatewayPath for proxy-iframe, baseUrl otherwise', () => {
    const superset = getToolById('superset')!
    expect(superset.integrationMode).toBe('proxy-iframe')
    expect(getToolEmbedUrl(superset)).toBe(superset.gatewayPath)

    const dagster = getToolById('dagster')!
    expect(getToolEmbedUrl(dagster)).toBe(dagster.baseUrl)
  })
})
