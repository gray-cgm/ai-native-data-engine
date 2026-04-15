import bootstrapHandler from '../handlers/bootstrapHandler.js';
import { defineRoute } from './route-types.js';
import { buildOutputSchema } from './schema.js';
const route = defineRoute({
    method: 'post',
    path: '/bootstrap',
    validate: {
        output: buildOutputSchema(),
    },
    meta: {
        swagger: {
            summary: 'Bootstrap demo dataset',
            description: 'Trigger the demo ingest flow in Platform API.',
            tags: ['bootstrap'],
        },
    },
    handler: bootstrapHandler.create,
});
export default route;
