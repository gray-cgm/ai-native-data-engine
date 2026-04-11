import { config } from '../config/index.js';
const route = {
    method: 'get',
    path: '/health',
    handler: async (ctx) => {
        ctx.body = {
            status: 'ok',
            service: 'bff',
            upstream: config.platformApiBaseUrl,
        };
    },
};
export default route;
