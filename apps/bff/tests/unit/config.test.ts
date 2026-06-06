import { describe, expect, it } from 'vitest'

import { config } from '../../src/config/index.js'

describe('config', () => {
  it('exposes defaults derived from env', () => {
    expect(config.appName).toBeTruthy()
    expect(typeof config.port).toBe('number')
    expect(config.apiPrefix).toBe('/api')
    expect(config.bodyLimit).toBeTruthy()
  })

  it('strips a trailing slash from platformApiBaseUrl', () => {
    expect(config.platformApiBaseUrl.endsWith('/')).toBe(false)
  })

  it('exposes tool base urls for the four gateway tools', () => {
    expect(Object.keys(config.toolBaseUrls).sort()).toEqual([
      'dagster',
      'jupyter',
      'kafka-ui',
      'superset',
    ])
    for (const url of Object.values(config.toolBaseUrls)) {
      expect(url.endsWith('/')).toBe(false)
    }
  })

  it('exposes kafka streaming defaults', () => {
    expect(config.kafka.topicEvents).toBeTruthy()
    expect(config.kafka.topicDlq).toBeTruthy()
    expect(config.kafka.uiHealthPath.startsWith('/')).toBe(true)
  })
})
