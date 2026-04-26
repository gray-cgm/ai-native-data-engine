const defaultPort = 3100

function getNumberEnv(name: string, fallback: number) {
  const value = process.env[name]
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  appName: process.env.BFF_APP_NAME ?? 'ai-data-loop-bff',
  env: process.env.NODE_ENV ?? 'development',
  version: process.env.BFF_VERSION ?? '0.1.0',
  host: process.env.BFF_HOST ?? '0.0.0.0',
  port: getNumberEnv('BFF_PORT', defaultPort),
  apiPrefix: process.env.BFF_API_PREFIX ?? '/api',
  bodyLimit: process.env.BFF_BODY_LIMIT ?? '50mb',
  platformApiBaseUrl: (process.env.PLATFORM_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, ''),
  toolBaseUrls: {
    dagster: (process.env.TOOL_DAGSTER_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, ''),
    superset: (process.env.TOOL_SUPERSET_BASE_URL ?? 'http://127.0.0.1:8088').replace(/\/$/, ''),
    jupyter: (process.env.TOOL_JUPYTER_BASE_URL ?? 'http://127.0.0.1:8888').replace(/\/$/, ''),
    'kafka-ui': (process.env.TOOL_KAFKA_UI_BASE_URL ?? 'http://127.0.0.1:8085').replace(/\/$/, ''),
  },
  kafka: {
    bootstrapServers: process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'localhost:9092',
    topicEvents: process.env.KAFKA_TOPIC_EVENTS ?? 'streaming.events.raw',
    topicDlq: process.env.KAFKA_TOPIC_DLQ ?? 'streaming.events.dlq',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP ?? 'ad-loop-streaming-consumer',
    uiBaseUrl: (process.env.TOOL_KAFKA_UI_BASE_URL ?? 'http://127.0.0.1:8085').replace(/\/$/, ''),
    uiHealthPath: process.env.KAFKA_UI_HEALTH_PATH ?? '/actuator/health',
  },
}
