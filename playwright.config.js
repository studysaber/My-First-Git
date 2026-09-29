import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/My-First-Git/',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run serve',
    url: 'http://127.0.0.1:4173/My-First-Git/',
    reuseExistingServer: !process.env.CI,
    env: { BASE_PATH: '/My-First-Git/' },
    timeout: 30000,
  },
});
