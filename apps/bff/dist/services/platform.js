import { config } from '../config/index.js';
import { UpstreamHttpError } from '../errors.js';
export async function platformFetch(pathname, init) {
    const response = await fetch(`${config.platformApiBaseUrl}${pathname}`, init);
    const text = await response.text();
    const payload = parseResponseBody(text);
    if (!response.ok) {
        const detail = extractErrorMessage(payload) ?? text ?? `Platform API request failed: ${response.status}`;
        throw new UpstreamHttpError(detail, {
            status: response.status,
            upstreamBody: payload,
        });
    }
    return payload;
}
function parseResponseBody(text) {
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function extractErrorMessage(payload) {
    if (typeof payload === 'string') {
        return payload;
    }
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const detailMessage = payload.detailMessage;
    if (typeof detailMessage === 'string') {
        return detailMessage;
    }
    const error = payload.error;
    if (error && typeof error === 'object' && typeof error.message === 'string') {
        return error.message;
    }
    const message = payload.message;
    return typeof message === 'string' ? message : null;
}
