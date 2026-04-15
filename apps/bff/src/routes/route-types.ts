import type { Route } from 'koa-joi-router'

export type AppRoute = Route & {
  auth?: boolean
  meta?: {
    swagger?: {
      summary?: string
      description?: string
      tags?: string[]
    }
  }
}

export function defineRoute<T extends AppRoute>(route: T): T {
  return route
}