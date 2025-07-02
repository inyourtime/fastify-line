import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    watch: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
