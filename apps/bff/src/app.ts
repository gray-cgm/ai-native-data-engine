import Koa from 'koa'
import cors from '@koa/cors'
import { koaBody } from 'koa-body'
import JoiRouter from 'koa-joi-router'
import type { Middleware } from 'koa'

import { handleException } from './middlewares/index.js'
import { getApiRouter, healthRoute } from './routes/index.js'

const normalizeMiddleware = (middleware: unknown): Middleware => {
  if (typeof middleware !== 'function') {
    throw new TypeError('Expected Koa middleware function')
  }
  return middleware as Middleware
}

export function getApp() {
  const app = new Koa()

  const corsMiddleware = normalizeMiddleware(cors())
  const bodyMiddleware = normalizeMiddleware(koaBody({ jsonLimit: '10mb' }))
  const rootRouter = JoiRouter()
  rootRouter.route(healthRoute)
  const rootRouterMiddleware = normalizeMiddleware(rootRouter.middleware())
  const apiRouter = getApiRouter()
  const apiRouterMiddleware = normalizeMiddleware(apiRouter.middleware())

  app.use(async (ctx, next) => corsMiddleware(ctx, next))
  app.use(handleException)
  app.use(async (ctx, next) => bodyMiddleware(ctx, next))
  app.use(async (ctx, next) => rootRouterMiddleware(ctx, next))
  app.use(async (ctx, next) => apiRouterMiddleware(ctx, next))

  return app
}
