import { platformFetch } from '../services/platform.js'

export async function triggerStreamingBootstrap() {
  return platformFetch('/streaming/bootstrap', { method: 'POST' })
}