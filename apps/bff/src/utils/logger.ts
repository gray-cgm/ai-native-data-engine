import { AsyncLocalStorage } from 'node:async_hooks'

import { config } from '../config/index.js'
import { removeUndefinedKeys } from './object.js'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type RequestContext = {
  requestId: string
}

const requestContextStore = new AsyncLocalStorage<RequestContext>()

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel
const minimumLogLevel = levelWeight[configuredLevel] ? configuredLevel : 'info'

function shouldLog(level: LogLevel) {
  return levelWeight[level] >= levelWeight[minimumLogLevel]
}

function emit(level: LogLevel, message: string, details?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return
  }

  const payload = removeUndefinedKeys({
    timestamp: new Date().toISOString(),
    level,
    service: config.appName,
    env: config.env,
    requestId: requestContextStore.getStore()?.requestId,
    message,
    ...details,
  })

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export const requestContext = {
  run<T>(requestId: string, callback: () => Promise<T>) {
    return requestContextStore.run({ requestId }, callback)
  },
  getRequestId() {
    return requestContextStore.getStore()?.requestId
  },
}

export const logger = {
  debug(message: string, details?: Record<string, unknown>) {
    emit('debug', message, details)
  },
  info(message: string, details?: Record<string, unknown>) {
    emit('info', message, details)
  },
  warn(message: string, details?: Record<string, unknown>) {
    emit('warn', message, details)
  },
  error(message: string, details?: Record<string, unknown>) {
    emit('error', message, details)
  },
}