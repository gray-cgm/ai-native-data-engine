import { describe, expect, it } from 'vitest'
import { resolveGatewayPath, resolveToolBaseUrl, toAbsoluteUrl } from './runtime'

describe('resolveToolBaseUrl', () => {
  it('prefers a non-empty env override', () => {
    expect(resolveToolBaseUrl(3001, 'https://dagster.example')).toBe('https://dagster.example')
  })
  it('falls back to window origin host + port', () => {
    // jsdom default origin is http://localhost
    expect(resolveToolBaseUrl(8088)).toBe('http://localhost:8088')
  })
  it('ignores blank env override', () => {
    expect(resolveToolBaseUrl(8888, '   ')).toBe('http://localhost:8888')
  })
})

describe('toAbsoluteUrl', () => {
  it('joins base and pathname, trimming trailing slash', () => {
    expect(toAbsoluteUrl('http://host:1/', 'docs')).toBe('http://host:1/docs')
    expect(toAbsoluteUrl('http://host:1', '')).toBe('http://host:1/')
  })
})

describe('resolveGatewayPath', () => {
  it('returns the pathname portion only', () => {
    expect(resolveGatewayPath('/api/tools-gateway/dagster/')).toBe('/api/tools-gateway/dagster/')
  })
})
