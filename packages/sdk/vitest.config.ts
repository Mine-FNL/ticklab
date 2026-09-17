import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // Default project excludes the integration file when the env var is missing,
    // but integration.test.ts is also guarded internally so it no-ops cleanly.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ['default'],
  },
});