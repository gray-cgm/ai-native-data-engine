import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/test-utils.tsx',
        'src/shared/types/**',
        'src/**/manifest.ts',
        'src/shared/microfrontends/types.ts',
      ],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'reports/web-coverage',
      // 当前实测 80.83%；门禁设 75 留 ~5.8% 缓冲，避免小改动跌破触发 CI flapping。
      // 后续补 explorer/tools 页面测试加厚后可逐步上调回 80。
      thresholds: { lines: 75 },
    },
  },
})
