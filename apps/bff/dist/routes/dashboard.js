import { buildDashboardPayload } from '../services/dashboard.js';
const route = {
    method: 'get',
    path: '/dashboard',
    handler: async (ctx) => {
        ctx.body = await buildDashboardPayload();
    },
};
export default route;
