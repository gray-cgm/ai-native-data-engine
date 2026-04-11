import Koa from 'koa'
import type { Context } from 'koa'
import cors from '@koa/cors'
import { koaBody } from 'koa-body'
import JoiRouter from 'koa-joi-router'

import { handleException } from './middlewares/index.js'
import { getApiRouter, healthRoute } from './routes/index.js'

export function getApp() {
  const app = new Koa()

  app.use(cors())
  app.use(handleException)
  app.use(koaBody({ jsonLimit: '10mb' }))

  const rootRouter = JoiRouter()
  rootRouter.route(healthRoute)
  app.use(rootRouter.middleware())

  const apiRouter = getApiRouter()
  app.use(apiRouter.middleware())

  return app
}
