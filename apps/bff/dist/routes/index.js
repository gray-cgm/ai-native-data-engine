import JoiRouter from 'koa-joi-router';
import bootstrapRoute from './bootstrap.js';
import dashboardRoute from './dashboard.js';
import exportRoute from './exports.js';
export function getApiRouter() {
    const router = JoiRouter();
    router.prefix('/api');
    router.route([bootstrapRoute, dashboardRoute, exportRoute]);
    return router;
}
export { default as healthRoute } from './health.js';
