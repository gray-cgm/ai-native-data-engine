export const config = {
  host: process.env.BFF_HOST ?? '0.0.0.0',
  port: Number(process.env.BFF_PORT ?? 3100),
  platformApiBaseUrl: (process.env.PLATFORM_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, ''),
}
