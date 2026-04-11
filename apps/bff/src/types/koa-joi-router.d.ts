declare module 'koa-joi-router' {
  import type { Middleware } from 'koa'

  export type Route = {
    method: string
    path: string
    validate?: Record<string, unknown>
    handler: Middleware
    meta?: Record<string, unknown>
    auth?: boolean
  }

  type RouterInstance = {
    prefix(path: string): void
    route(route: Route | Route[]): void
    middleware(): Middleware
  }

  export const Joi: {
    string(): any
  }

  export default function JoiRouter(): RouterInstance
}
