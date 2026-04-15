import exportHandler from '../handlers/exportHandler.js';
import { defineRoute } from './route-types.js';
import { buildOutputSchema, Joi } from './schema.js';
const route = defineRoute({
    method: 'post',
    path: '/datasets/:datasetId/exports',
    validate: {
        params: {
            datasetId: Joi.string().required(),
        },
        type: 'json',
        body: Joi.object({
            format: Joi.string().valid('lance', 'csv', 'jsonl').default('lance'),
        }).required(),
        output: buildOutputSchema(),
    },
    meta: {
        swagger: {
            summary: 'Create dataset export',
            description: 'Forward an export request to the Platform API for the target dataset.',
            tags: ['exports'],
        },
    },
    handler: exportHandler.createDatasetExport,
});
export default route;
