import { randomUUID } from 'node:crypto';
import { errorCodes } from '../const/error.js';
import { errorTypes } from '../dictionary/error.js';
import { AppError, UpstreamHttpError } from '../errors.js';
import { logger, requestContext } from '../utils/logger.js';
import { removeUndefinedKeys } from '../utils/object.js';
export async function handleException(ctx, next) {
    const requestId = randomUUID();
    await requestContext.run(requestId, async () => {
        const startTime = Date.now();
        ctx.state.requestId = requestId;
        try {
            await next();
            if (ctx.status === 404 && ctx.body == null) {
                throw new AppError('Route not found', {
                    status: 404,
                    code: errorCodes.router.unknown,
                    detailMessage: `Unknown route: ${ctx.method} ${ctx.path}`,
                });
            }
        }
        catch (error) {
            const response = resolveErrorResponse(error);
            ctx.status = response.status;
            ctx.body = {
                ...response,
                success: false,
                requestId,
                data: null,
                error: {
                    message: response.detailMessage ?? response.message?.en ?? 'request failed',
                },
            };
            const details = {
                status: response.status,
                code: response.code,
                method: ctx.method,
                path: ctx.path,
                detailMessage: response.detailMessage,
                upstreamStatus: error instanceof UpstreamHttpError ? error.upstreamStatus : undefined,
                errorName: error instanceof Error ? error.name : 'UnknownError',
            };
            if (response.status >= 500) {
                logger.error('request_failed', details);
            }
            else {
                logger.warn('request_failed', details);
            }
        }
        finally {
            ctx.set('x-request-id', requestId);
            const requestLog = removeUndefinedKeys({
                status: ctx.status,
                requestId,
                usedTime: Date.now() - startTime,
                method: ctx.method,
                path: ctx.path,
                query: Object.keys(ctx.query).length > 0 ? ctx.query : undefined,
            });
            if (ctx.status >= 500) {
                logger.error('request_completed', requestLog);
            }
            else if (ctx.status >= 400) {
                logger.warn('request_completed', requestLog);
            }
            else {
                logger.info('request_completed', requestLog);
            }
        }
    });
}
function resolveErrorResponse(error) {
    if (isValidationError(error)) {
        const status = getNumericProperty(error, 'status') ?? 400;
        return {
            status,
            code: status >= 500 ? errorCodes.router.responseFieldIncorrect : errorCodes.router.requestParamIncorrect,
            detailMessage: getValidationErrorMessage(error),
            message: errorTypes[status >= 500 ? errorCodes.router.responseFieldIncorrect : errorCodes.router.requestParamIncorrect],
        };
    }
    if (error instanceof AppError) {
        return {
            status: error.status,
            code: error.code,
            detailMessage: error.detailMessage,
            message: errorTypes[error.code],
        };
    }
    return {
        status: 500,
        code: errorCodes.system.unknown,
        detailMessage: error instanceof Error ? error.message : 'Unknown error',
        message: errorTypes[errorCodes.system.unknown],
    };
}
function isValidationError(error) {
    return Boolean(error && typeof error === 'object' && error.name === 'ValidationError');
}
function getValidationErrorMessage(error) {
    return error.details?.[0]?.message ?? 'Validation failed';
}
function getNumericProperty(value, key) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const candidate = value[key];
    return typeof candidate === 'number' ? candidate : undefined;
}
