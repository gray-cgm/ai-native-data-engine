import catalogHandler from '../handlers/catalogHandler.js'
import { defineRoute } from './route-types.js'
import { workspaceSchema } from './resource-schemas.js'
import { buildListQuerySchema, buildOutputSchema, buildPaginatedListSchema } from './schema.js'

/**
 * Catalog 仅保留 workspace 列表；旧的 ``GET /datasets``、``/datasets/:id``、
 * ``/datasets/:id/versions`` 已在 v3 重构中下线 —— catalog adapter 的 datasets 表
 * 被 datasets_v2 + DatasetSample 取代，新 dataset CRUD 全在 ``routes/datasets.ts``。
 *
 * 注：``dashboardEngine.ts`` / ``services/tools.ts`` 仍直接 ``platformFetch('/datasets')``
 * 拉 legacy adapter 的内容，那是平台 API 路径，不依赖本 BFF 路由表。
 */

export default [
  defineRoute({
    method: 'get',
    path: '/workspaces',
    validate: {
      query: buildListQuerySchema(),
      output: buildOutputSchema(buildPaginatedListSchema(workspaceSchema)),
    },
    meta: {
      swagger: {
        summary: 'List workspaces',
        description: 'Workspace management list endpoint with local search, sort and pagination.',
        tags: ['catalog'],
      },
    },
    handler: catalogHandler.listWorkspaces,
  }),
]
