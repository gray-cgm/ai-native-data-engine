export async function handleException(ctx, next) {
    try {
        await next();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        ctx.status = 500;
        ctx.body = {
            error: {
                message,
            },
        };
    }
}
