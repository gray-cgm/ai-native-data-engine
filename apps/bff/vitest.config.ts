import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'reports/bff-coverage',
      include: ['src/**'],
      exclude: [
        'src/index.ts',
        'src/server.ts',
        'src/**/*.d.ts',
        'src/types.ts',
        'src/types/**',
        'src/const/**',
        'src/dictionary/**',
      ],
      thresholds: { lines: 80 },
    },
  },
})
