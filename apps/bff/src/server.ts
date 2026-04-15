import { getApp } from './app.js'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'

export async function start() {
  const app = await getApp()

  return app.listen(config.port, config.host, () => {
    logger.info('server_started', {
      host: config.host,
      port: config.port,
      env: config.env,
      apiPrefix: config.apiPrefix,
      upstream: config.platformApiBaseUrl,
    })
  })
}