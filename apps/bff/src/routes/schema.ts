import JoiRouter from 'koa-joi-router'

const { Joi } = JoiRouter as typeof JoiRouter & {
  Joi: {
    any(): any
    array(): any
    boolean(): any
    number(): any
    object(schema?: Record<string, unknown>): any
    string(): any
  }
}

export { Joi }

export const errorMessageSchema = Joi.object({
  cn: Joi.string().allow(null),
  en: Joi.string().allow(null),
})

export const successMessageSchema = Joi.object({
  cn: Joi.string().allow(null),
  en: Joi.string().allow(null),
})

export const successEnvelopeSchema = Joi.object({
  status: Joi.number().integer().required(),
  code: Joi.number().integer().required(),
  success: Joi.boolean().required(),
  detailMessage: Joi.string().allow(null),
  message: successMessageSchema.required(),
  requestId: Joi.string().required(),
  data: Joi.any(),
}).unknown(true)

export const errorResponseSchema = Joi.object({
  status: Joi.number().integer().required(),
  code: Joi.number().integer().required(),
  detailMessage: Joi.string().allow(null),
  message: errorMessageSchema.allow(null),
  requestId: Joi.string().required(),
  error: Joi.object({
    message: Joi.string().allow(null),
  }).required(),
}).unknown(true)

export const paginationSchema = {
  request: {
    page: Joi.number().integer().min(1).default(1).description('指定页数'),
    pageSize: Joi.number().integer().min(1).default(10).description('限定条数'),
    sortField: Joi.string().description('排序字段').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').description('排序顺序').default('desc'),
  },
  response: {
    pagination: Joi.object({
      total: Joi.number().integer().min(0).required(),
    }),
  },
}

export function buildListQuerySchema(extraFields: Record<string, unknown> = {}) {
  return Joi.object({
    q: Joi.string().optional(),
    page: Joi.number().integer().min(1).optional(),
    pageSize: Joi.number().integer().min(1).optional(),
    skip: Joi.number().integer().min(0).optional(),
    limit: Joi.number().integer().min(0).optional(),
    sortField: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    sort: Joi.string().optional(),
    ...extraFields,
  }).unknown(true)
}

export function buildPaginatedListSchema(itemSchema = Joi.object().unknown(true)) {
  return Joi.object({
    items: Joi.array().items(itemSchema).required(),
    pagination: Joi.object({
      total: Joi.number().integer().min(0).required(),
      skip: Joi.number().integer().min(0).required(),
      limit: Joi.number().integer().min(0).required(),
    }).required(),
  }).unknown(true)
}

export function buildOutputSchema(bodySchema = Joi.any()) {
  return {
    200: {
      body: bodySchema,
    },
    400: {
      body: errorResponseSchema,
    },
    404: {
      body: errorResponseSchema,
    },
    500: {
      body: errorResponseSchema,
    },
    502: {
      body: errorResponseSchema,
    },
  }
}