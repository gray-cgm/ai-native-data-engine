import Koa from 'koa';
import cors from '@koa/cors';
import { koaBody } from 'koa-body';
import JoiRouter from 'koa-joi-router';
import { config } from './config/index.js';
import { cleanTimestamp, handleException, pagination, wrapResponse } from './middlewares/index.js';
import { getApiRouter, getApiRoutes, getDocsRouter, healthRoute } from './routes/index.js';
import { logger } from './utils/logger.js';
const normalizeMiddleware = (middleware) => {
    if (typeof middleware !== 'function') {
        throw new TypeError('Expected Koa middleware function');
    }
    return middleware;
};
export async function getApp() {
    const app = new Koa();
    const corsMiddleware = normalizeMiddleware(cors());
    const bodyMiddleware = normalizeMiddleware(koaBody({ jsonLimit: config.bodyLimit }));
    const rootRouter = JoiRouter();
    rootRouter.route(healthRoute);
    const rootRouterMiddleware = normalizeMiddleware(rootRouter.middleware());
    const apiRoutes = await getApiRoutes();
    const apiRouter = await getApiRouter();
    const apiRouterMiddleware = normalizeMiddleware(apiRouter.middleware());
    const docsRouter = getDocsRouter(apiRoutes);
    const docsRouterMiddleware = normalizeMiddleware(docsRouter.middleware());
    app.use(async (ctx, next) => corsMiddleware(ctx, next));
    app.use(cleanTimestamp);
    app.use(handleException);
    app.use(wrapResponse);
    app.use(async (ctx, next) => bodyMiddleware(ctx, next));
    app.use(pagination);
    app.use(async (ctx, next) => rootRouterMiddleware(ctx, next));
    app.use(async (ctx, next) => apiRouterMiddleware(ctx, next));
    app.use(async (ctx, next) => docsRouterMiddleware(ctx, next));
    app.on('error', (error) => {
        logger.error('app_error', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
            detailMessage: error instanceof Error ? error.message : String(error),
        });
    });
    return app;
}
