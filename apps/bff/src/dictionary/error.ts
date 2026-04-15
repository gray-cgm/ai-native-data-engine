import { errorCodes } from '../const/error.js'

export const errorTypes: Record<number, { cn: string; en: string }> = {
  [errorCodes.router.unknown]: { cn: '未知路由', en: 'unknown route' },
  [errorCodes.router.requestParamIncorrect]: {
    cn: '请求参数校验错误',
    en: 'request param incorrect',
  },
  [errorCodes.router.responseFieldIncorrect]: {
    cn: '返回数据字段校验错误',
    en: 'response field incorrect',
  },
  [errorCodes.platform.requestFailed]: {
    cn: '上游平台请求失败',
    en: 'platform request failed',
  },
  [errorCodes.system.unknown]: {
    cn: '系统未知错误',
    en: 'unknown system error',
  },
} as const

export type ErrorDescriptor = (typeof errorTypes)[keyof typeof errorTypes]