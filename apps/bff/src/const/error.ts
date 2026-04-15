export const errorCodes = {
  router: {
    unknown: 10001001,
    requestParamIncorrect: 10001002,
    responseFieldIncorrect: 10001003,
  },
  platform: {
    requestFailed: 10004001,
  },
  system: {
    unknown: 20000001,
  },
} as const

export type ErrorCode = number