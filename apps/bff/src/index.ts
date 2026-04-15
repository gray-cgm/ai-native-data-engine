import { config } from './config/index.js'
import { start } from './server.js'

start().catch((error) => {
  console.error(`Failed to start ${config.appName}:`, error)
  process.exitCode = 1
})
