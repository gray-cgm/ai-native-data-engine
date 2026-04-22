import clipsHandler from '../handlers/clipsHandler.js'
import { defineRoute } from './route-types.js'
import { buildListQuerySchema, buildOutputSchema, Joi } from './schema.js'

const unknownObject = Joi.object().unknown(true)

export default [
  defineRoute({
    method: 'get',
    path: '/clips',
    validate: {
      query: buildListQuerySchema(),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'List clips',
        description: 'Discover clip directories under data/lance and return clip-level summary.',
        tags: ['clips'],
      },
    },
    handler: clipsHandler.list,
  }),
  defineRoute({
    method: 'get',
    path: '/clips/:clipId',
    validate: {
      params: { clipId: Joi.string().required() },
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Get clip detail',
        description: 'Return clip summary, parsed meta and per-camera catalog.',
        tags: ['clips'],
      },
    },
    handler: clipsHandler.detail,
  }),
  defineRoute({
    method: 'get',
    path: '/clips/:clipId/frames',
    validate: {
      params: { clipId: Joi.string().required() },
      query: Joi.object({
        topic: Joi.string().optional(),
        camera: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(500).optional(),
        offset: Joi.number().integer().min(0).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Read aligned keyframe rows',
        description: 'Preview rows from topic.lance, optionally filtered by topic or camera.',
        tags: ['clips'],
      },
    },
    handler: clipsHandler.frames,
  }),
  defineRoute({
    method: 'get',
    path: '/clips/:clipId/standalone/:name',
    validate: {
      params: {
        clipId: Joi.string().required(),
        name: Joi.string().required(),
      },
      query: Joi.object({
        limit: Joi.number().integer().min(1).max(500).optional(),
        offset: Joi.number().integer().min(0).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Read standalone topic rows',
        description: 'Preview rows from a <Topic>.lance sibling table.',
        tags: ['clips'],
      },
    },
    handler: clipsHandler.standaloneTopic,
  }),
  defineRoute({
    method: 'get',
    path: '/clips/:clipId/cameras/:camera/aligned',
    validate: {
      params: {
        clipId: Joi.string().required(),
        camera: Joi.string().required(),
      },
      query: Joi.object({
        limit: Joi.number().integer().min(1).max(5000).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'List aligned camera frames',
        description: 'Return {timestamp, video_frame_timestamp, video_frame_index} rows for a camera.',
        tags: ['clips'],
      },
    },
    handler: clipsHandler.aligned,
  }),
  defineRoute({
    method: 'get',
    path: '/clips/:clipId/cameras/:camera/video',
    validate: {
      params: {
        clipId: Joi.string().required(),
        camera: Joi.string().required(),
      },
      output: {
        200: { body: Joi.any() },
        206: { body: Joi.any() },
        400: { body: unknownObject },
        404: { body: unknownObject },
        409: { body: unknownObject },
        500: { body: unknownObject },
        502: { body: unknownObject },
      },
    },
    meta: {
      swagger: {
        summary: 'Stream clip camera video',
        description: 'Proxy the Platform API mp4 stream. Supports HTTP Range.',
        tags: ['clips'],
      },
    },
    handler: clipsHandler.video,
  }),
]
