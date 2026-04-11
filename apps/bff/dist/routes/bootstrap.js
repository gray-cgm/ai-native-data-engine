import { platformFetch } from '../services/platform.js';
const route = {
    method: 'post',
    path: '/bootstrap',
    handler: async (ctx) => {
        ctx.body = await platformFetch('/samples/ingest-demo', { method: 'POST' });
    },
};
export default route;
