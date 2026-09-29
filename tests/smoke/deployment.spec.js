const { test, expect } = require('@playwright/test');

const ignoredConsolePatterns = [
  /outgoingmessage\.prototype\._headers is deprecated/i
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const analyticsOrigin = 'https://stats.canadianhockeypyramid.com';
    const originalFetch = window.fetch.bind(window);
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);

    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url;

      if (url?.startsWith(analyticsOrigin)) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return originalFetch(input, init);
    };

    navigator.sendBeacon = (url, data) => {
      if (String(url).startsWith(analyticsOrigin)) {
        return true;
      }

      return originalSendBeacon(url, data);
    };
  });
});

function monitorCriticalErrors(page) {
  const errors = [];

  page.on('pageerror', error => {
    errors.push(`Uncaught page error: ${error.message}`);
  });

  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!ignoredConsolePatterns.some(pattern => pattern.test(text))) {
      errors.push(`Console error: ${text}`);
    }
  });

  page.on('requestfailed', request => {
    const failure = request.failure();
    errors.push(`Failed request: ${request.method()} ${request.url()} (${failure?.errorText || 'unknown error'})`);
  });

  return errors;
}

test('deployment loads as the Canadian Hockey Pyramid application', async ({ page, baseURL }) => {
  const errors = monitorCriticalErrors(page);
  const response = await page.goto('/', { waitUntil: 'networkidle' });

  expect(response, `No main-document response from ${baseURL}`).not.toBeNull();
  expect(response.ok(), `Main document returned HTTP ${response.status()}`).toBeTruthy();
  await expect(page).toHaveTitle(/Canadian Hockey Pyramid/i);
  await expect(page.locator('body')).not.toBeEmpty();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('deployment remains usable after a clean reload', async ({ page }) => {
  const errors = monitorCriticalErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });

  await expect(page).toHaveTitle(/Canadian Hockey Pyramid/i);
  await expect(page.locator('body')).not.toBeEmpty();
  expect(errors, errors.join('\n')).toEqual([]);
});
