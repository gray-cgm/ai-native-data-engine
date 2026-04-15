import { Joi } from 'koa-joi-router';
import { platformFetch } from '../services/platform.js';
const ALLOWED_EXPORT_FORMATS = new Set(['lance', 'csv', 'jsonl']);
const route = {
    method: 'post',
    path: '/datasets/:datasetId/exports',
    validate: {
        params: {
            datasetId: Joi.string().required(),
        },
    },
    handler: async (ctx) => {
        const request = ctx.request;
        const datasetId = request.params.datasetId;
        const requestBody = request.body && typeof request.body === 'object' ? request.body : {};
        const format = requestBody.format ?? 'lance';
        if (typeof format !== 'string' || !ALLOWED_EXPORT_FORMATS.has(format)) {
            ctx.status = 400;
            ctx.body = { error: { message: 'invalid export format' } };
            return;
        }
        ctx.body = await platformFetch(`/exports/dataset/${datasetId}?format=${encodeURIComponent(format)}`, {
            method: 'POST',
        });
    },
};
export default route;
