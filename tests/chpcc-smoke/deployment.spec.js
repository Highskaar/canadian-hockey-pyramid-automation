const { test: base, expect } = require('@playwright/test');

const expectedVersion = process.env.TEST_EXPECTED_VERSION;
const analyticsOrigin = 'https://stats.canadianhockeypyramid.com';

if (!expectedVersion) {
  throw new Error('TEST_EXPECTED_VERSION is required.');
}

const test = base.extend({
  observed: async ({ page }, use) => {
    const errors = [];

    await page.addInitScript(origin => {
      const originalFetch = window.fetch.bind(window);
      const originalSendBeacon =
        typeof navigator.sendBeacon === 'function'
          ? navigator.sendBeacon.bind(navigator)
          : null;

      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;

        if (url?.startsWith(origin)) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        return originalFetch(input, init);
      };

      navigator.sendBeacon = (url, data) => {
        if (String(url).startsWith(origin)) {
          return true;
        }

        return originalSendBeacon
          ? originalSendBeacon(url, data)
          : false;
      };
    }, analyticsOrigin);

    page.on('pageerror', error => {
      errors.push(Uncaught page error: ${error.message});
    });

    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(Console error: ${message.text()});
      }
    });

    page.on('requestfailed', request => {
      if (request.url().startsWith(analyticsOrigin)) {
        return;
      }

      const failure = request.failure();

      errors.push(
        Failed request: ${request.method()} ${request.url()}  +
        (${failure?.errorText || 'unknown error'})
      );
    });

    await use({ page, errors });

    expect(errors, errors.join('\n')).toEqual([]);
  }
});

async function openCHPCC(page) {
  const response = await page.goto('/', {
    waitUntil: 'domcontentloaded'
  });

  expect(
    response,
    'The CHPCC main document did not return a response'
  ).not.toBeNull();

  expect(
    response.ok(),
    CHPCC main document returned HTTP ${response.status()}
  ).toBeTruthy();

  await expect(page.locator('body')).not.toBeEmpty();
}

test('CHPCC deployment loads the expected v0.22 release', async ({
  observed
}) => {
  const { page } = observed;

  await openCHPCC(page);

  await expect(page.locator('body')).toContainText(
    v${expectedVersion}
  );
});

test('CHPCC deployment remains available after reload', async ({
  observed
}) => {
  const { page } = observed;

  await openCHPCC(page);

  await page.reload({
    waitUntil: 'domcontentloaded'
  });

  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.locator('body')).toContainText(
    v${expectedVersion}
  );
});
