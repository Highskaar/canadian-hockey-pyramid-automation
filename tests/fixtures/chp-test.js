const { test: base, expect } = require('@playwright/test');

const analyticsOrigin = 'https://stats.canadianhockeypyramid.com';

const test = base.extend({
  criticalErrors: async ({ page }, use) => {
    const errors = [];

    await page.addInitScript(origin => {
      const originalFetch = window.fetch.bind(window);
      const originalSendBeacon = typeof navigator.sendBeacon === 'function'
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
        if (String(url).startsWith(origin)) return true;
        return originalSendBeacon ? originalSendBeacon(url, data) : false;
      };
    }, analyticsOrigin);

    page.on('pageerror', error => {
      errors.push(`Uncaught page error: ${error.message}`);
    });

    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(`Console error: ${message.text()}`);
      }
    });

    page.on('requestfailed', request => {
      if (request.url().startsWith(analyticsOrigin)) return;
      const failure = request.failure();
      errors.push(
        `Failed request: ${request.method()} ${request.url()} ` +
        `(${failure?.errorText || 'unknown error'})`
      );
    });

    await use(errors);
    expect(errors, errors.join('\n')).toEqual([]);
  }
});

async function dismissIntro(page) {
  const overlay = page.locator('#p4Overlay');
  await overlay.waitFor({ state: 'attached' });
  await expect(overlay).toBeVisible();

  const dontShowAgain = page.locator('[data-p4-dont]');
  await dontShowAgain.check();

  const continueButton = page.locator('[data-p4-new]');
  const coarsePointer = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (coarsePointer) {
    await continueButton.tap();
  } else {
    await continueButton.click();
  }

  await expect(overlay).toHaveClass(/hidden/);
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('chp-intro-hidden-v1'))
  ).toBe('1');
}

async function openApp(page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response, 'The main document did not return a response').not.toBeNull();
  expect(response.ok(), `Main document returned HTTP ${response.status()}`).toBeTruthy();
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await dismissIntro(page);
  await expect(page.locator('#mainView')).toBeVisible();
  await expect(page.locator('#tierTabs button').first()).toBeVisible();
  return response;
}

async function activate(locator, testInfo) {
  if (testInfo.project.name === 'iphone-chromium') {
    await locator.tap();
  } else {
    await locator.click();
  }
}

async function sumVisibleGamesPlayed(page) {
  return page.locator('table.standings tbody tr td:nth-child(3)').evaluateAll(cells =>
    cells.reduce((sum, cell) => sum + Number(cell.textContent || 0), 0)
  );
}

function versionAtLeast(actual, required) {
  const parse = value => String(value || '').split('.').map(part => Number(part) || 0);
  const a = parse(actual);
  const b = parse(required);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] || 0;
    const right = b[index] || 0;
    if (left !== right) return left > right;
  }
  return true;
}

module.exports = {
  test,
  expect,
  openApp,
  activate,
  sumVisibleGamesPlayed,
  versionAtLeast
};
