const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.TEST_BASE_URL;

if (!baseURL) {
  throw new Error('TEST_BASE_URL is required. Supply the exact HTTPS deployment URL.');
}

let parsedURL;
try {
  parsedURL = new URL(baseURL);
} catch {
  throw new Error('TEST_BASE_URL must be a valid URL.');
}

if (parsedURL.protocol !== 'https:') {
  throw new Error('TEST_BASE_URL must use HTTPS.');
}

if (['localhost', '127.0.0.1', '::1'].includes(parsedURL.hostname)) {
  throw new Error('Cloud workflows must test an external deployment, not localhost.');
}

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: parsedURL.toString(),
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure'
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'iphone-chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium'
      }
    }
  ]
});
