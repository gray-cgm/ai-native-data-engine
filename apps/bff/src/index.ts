import { getApp } from './app.js'
import { config } from './config/index.js'

const app = getApp()

app.listen(config.port, config.host, () => {
  console.log(`BFF server listening on http://${config.host}:${config.port}`)
})
