import catalogHandler from '../handlers/catalogHandler.js'
import { defineRoute } from './route-types.js'
import {
  datasetDetailSchema,
  datasetSchema,
  datasetVersionSchema,
  workspaceSchema,
} from './resource-schemas.js'
import { buildListQuerySchema, buildOutputSchema, buildPaginatedListSchema, Joi } from './schema.js'

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
  defineRoute({
    method: 'get',
    path: '/datasets',
    validate: {
      query: buildListQuerySchema({
        workspaceId: Joi.string().optional(),
        profile: Joi.string().optional(),
      }),
      output: buildOutputSchema(buildPaginatedListSchema(datasetSchema)),
    },
    meta: {
      swagger: {
        summary: 'List datasets',
        description: 'Dataset management list endpoint with workspace/profile filtering plus local search and pagination.',
        tags: ['catalog'],
      },
    },
    handler: catalogHandler.listDatasets,
  }),
  defineRoute({
    method: 'get',
    path: '/datasets/:datasetId',
    validate: {
      params: {
        datasetId: Joi.string().required(),
      },
      output: buildOutputSchema(datasetDetailSchema),
    },
    meta: {
      swagger: {
        summary: 'Get dataset detail',
        description: 'Return dataset detail and version list for management pages.',
        tags: ['catalog'],
      },
    },
    handler: catalogHandler.getDataset,
  }),
  defineRoute({
    method: 'get',
    path: '/datasets/:datasetId/versions',
    validate: {
      params: {
        datasetId: Joi.string().required(),
      },
      query: buildListQuerySchema({
        tableName: Joi.string().optional(),
      }),
      output: buildOutputSchema(buildPaginatedListSchema(datasetVersionSchema)),
    },
    meta: {
      swagger: {
        summary: 'List dataset versions',
        description: 'Dataset version management endpoint with local search, filtering and pagination.',
        tags: ['catalog'],
      },
    },
    handler: catalogHandler.listDatasetVersions,
  }),
]