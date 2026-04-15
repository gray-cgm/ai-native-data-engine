import { platformFetch } from '../services/platform.js'

export async function triggerDemoBootstrap() {
  return platformFetch('/samples/ingest-demo', { method: 'POST' })
}