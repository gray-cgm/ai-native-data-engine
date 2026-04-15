import { errorCodes, type ErrorCode } from './const/error.js'

type AppErrorOptions = {
  status: number
  code?: ErrorCode
  detailMessage?: string
  cause?: unknown
}

export class AppError extends Error {
  status: number
  code: ErrorCode
  detailMessage: string | null

  constructor(message: string, options: AppErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.status = options.status
    this.code = options.code ?? errorCodes.system.unknown
    this.detailMessage = options.detailMessage ?? message
  }
}

export class UpstreamHttpError extends AppError {
  upstreamStatus: number
  upstreamBody: unknown

  constructor(message: string, options: { status: number; upstreamBody?: unknown }) {
    super(message, {
      status: options.status,
      code: errorCodes.platform.requestFailed,
      detailMessage: message,
    })
    this.name = 'UpstreamHttpError'
    this.upstreamStatus = options.status
    this.upstreamBody = options.upstreamBody ?? null
  }
}