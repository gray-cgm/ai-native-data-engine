import { config } from '../config/index.js';
export async function platformFetch(pathname, init) {
    const response = await fetch(`${config.platformApiBaseUrl}${pathname}`, init);
    const text = await response.text();
    if (!response.ok) {
        throw new Error(text || `Platform API request failed: ${response.status}`);
    }
    return text ? JSON.parse(text) : null;
}
