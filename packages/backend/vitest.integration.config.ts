import { config as loadDotenv } from 'dotenv'
import { defineConfig } from 'vitest/config'

// TEST_DB_* may live in packages/backend/.env; real env vars take precedence.
loadDotenv({ quiet: true })

// Integration tests talk to a real MySQL database (TEST_DB_* env vars).
// They run serially because they share one schema.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
