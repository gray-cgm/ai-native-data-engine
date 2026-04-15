import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import JoiRouter from 'koa-joi-router'

import { config } from '../config/index.js'
import { buildOutputSchema, Joi } from './schema.js'
import type { AppRoute } from './route-types.js'

const routerDirectory = path.dirname(fileURLToPath(import.meta.url))
const ignoredFiles = new Set(['docs', 'health', 'index', 'resource-schemas', 'route-types', 'router', 'schema'])
const routeFilePattern = /\.(js|ts)$/

function getRouteFilePaths(directory: string) {
  const filePaths: string[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      filePaths.push(...getRouteFilePaths(absolutePath))
      continue
    }
    if (!routeFilePattern.test(entry.name)) {
      continue
    }
    const basename = entry.name.replace(routeFilePattern, '')
    if (ignoredFiles.has(basename)) {
      continue
    }
    filePaths.push(absolutePath)
  }
  return filePaths.sort()
}

async function loadRoutes() {
  const routes: AppRoute[] = []
  for (const filePath of getRouteFilePaths(routerDirectory)) {
    const module = (await import(pathToFileURL(filePath).href)) as { default?: AppRoute | AppRoute[] }
    if (!module.default) {
      continue
    }
    if (Array.isArray(module.default)) {
      routes.push(...module.default)
      continue
    }
    routes.push(module.default)
  }
  return routes
}

export async function getApiRoutes() {
  const routes = await loadRoutes()
  checkRouteValid(routes)
  normalizeRoutes(routes)
  return routes
}

function checkRouteValid(routes: AppRoute[]) {
  const seen = new Set<string>()
  for (const route of routes) {
    const method = route.method.toUpperCase()
    const key = `${method}:${route.path}`
    if (seen.has(key)) {
      throw new Error(`duplicate route definition: ${key}`)
    }
    if (!route.validate || typeof route.validate !== 'object') {
      route.validate = {}
    }
    seen.add(key)
  }
}

function normalizeRoutes(routes: AppRoute[]) {
  for (const route of routes) {
    const validate = route.validate ?? {}
    if (!validate.output || typeof validate.output !== 'object') {
      validate.output = buildOutputSchema(Joi.any())
    }
    if (route.auth) {
      validate.header = Joi.object({
        ...(typeof validate.header === 'object' && validate.header ? (validate.header as Record<string, unknown>) : {}),
        authorization: Joi.string().required().description('授权字符串，必填'),
      }).unknown()
    }
    route.validate = validate
  }
}

export async function getApiRouter() {
  const routes = await getApiRoutes()

  const router = JoiRouter()
  router.prefix(config.apiPrefix)
  router.route(routes)
  return router
}