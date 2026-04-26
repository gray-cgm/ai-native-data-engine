import { config } from '../config/index.js'
import { platformFetch } from '../services/platform.js'

export async function triggerStreamingBootstrap() {
  return platformFetch('/streaming/bootstrap', { method: 'POST' })
}

export async function getStreamingSummary() {
  return platformFetch('/streaming/summary')
}

type KafkaUiHealthResponse = {
  status?: string
  components?: Record<string, { status?: string; details?: Record<string, unknown> }>
} | null

type PlatformStreamingHealth = {
  checked_at: string
  broker: {
    bootstrap_servers: string
    topic_events: string
    topic_dlq: string
    consumer_group: string
  }
  consumer: {
    status: 'healthy' | 'lagging' | 'degraded' | 'idle' | 'unknown'
    counters?: Record<string, unknown>
    partition_lag?: Array<{ topic: string; partition: number; current_offset: number; end_offset: number; lag: number }>
    total_lag?: number
    detail?: string
    snapshot_at?: string
  }
  summary: Record<string, unknown> | null
}

/**
 * Pipelines Overview combines a kafka-ui health probe and the Platform API's
 * streaming health endpoint into a single ViewModel so the page can render a
 * Kafka tile with the same shape as the Dagster batch tile.
 */
export async function getStreamingHealth() {
  const platformPromise = platformFetch('/streaming/health').catch((error: unknown) => ({
    error: error instanceof Error ? error.message : String(error),
  })) as Promise<PlatformStreamingHealth | { error: string }>

  const kafkaUiHealthPromise = probeKafkaUiHealth()

  const [platform, kafkaUi] = await Promise.all([platformPromise, kafkaUiHealthPromise])

  return {
    checked_at: new Date().toISOString(),
    kafka_ui: kafkaUi,
    platform,
  }
}

async function probeKafkaUiHealth() {
  const url = `${config.kafka.uiBaseUrl}${config.kafka.uiHealthPath}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const status = response.status
    const text = await response.text()
    let body: KafkaUiHealthResponse = null
    try {
      body = text ? (JSON.parse(text) as KafkaUiHealthResponse) : null
    } catch {
      body = null
    }
    const reachable = response.ok
    const reportedStatus = body?.status ?? (reachable ? 'UP' : 'DOWN')
    return {
      endpoint: url,
      status_code: status,
      status: reachable ? (reportedStatus === 'UP' ? 'healthy' : 'degraded') : 'down',
      reported_status: reportedStatus,
      components: body?.components ?? null,
      base_url: config.kafka.uiBaseUrl,
      detail: null,
    }
  } catch (error: unknown) {
    return {
      endpoint: url,
      status_code: null,
      status: 'down',
      reported_status: null,
      components: null,
      base_url: config.kafka.uiBaseUrl,
      detail: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}