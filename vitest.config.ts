import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    // The api suite talks to a real database across the Atlantic; the unit
    // tests finish in milliseconds regardless.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
