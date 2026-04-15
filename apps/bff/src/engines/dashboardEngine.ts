import { buildDashboardPayload } from '../services/dashboard.js'

export async function getDashboardPayload() {
  return buildDashboardPayload()
}