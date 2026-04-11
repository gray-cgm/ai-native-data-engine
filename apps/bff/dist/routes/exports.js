import { Joi } from 'koa-joi-router';
import { platformFetch } from '../services/platform.js';
const route = {
    method: 'post',
    path: '/datasets/:datasetId/exports',
    validate: {
        params: {
            datasetId: Joi.string().required(),
        },
        type: 'json',
        body: {
            format: Joi.string().valid('parquet', 'csv', 'jsonl').optional(),
        },
    },
    handler: async (ctx) => {
        const request = ctx.request;
        const datasetId = request.params.datasetId;
        const requestBody = request.body ?? {};
        const format = requestBody.format ?? 'parquet';
        ctx.body = await platformFetch(`/exports/dataset/${datasetId}?format=${encodeURIComponent(format)}`, {
            method: 'POST',
        });
    },
};
export default route;
