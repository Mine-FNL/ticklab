import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for UniV3 Strategy Lab end-to-end tests.
 *
 * Notes:
 *  - Tests target the Next.js dev server (npm run dev) so we exercise the
 *    same surface a user would see in the browser.
 *  - Base URL can be overridden via the UNIVARIATE_BASE_URL env var.
 *  - In CI we run single-worker, with retries and the GitHub reporter.
 *  - Trace + screenshot + video capture is configured for failure debugging.
 */
const BASE_URL = process.env.UNIVARIATE_BASE_URL ?? 'http://localhost:3000';
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,
  reporter: IS_CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
    cwd: '..',
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
