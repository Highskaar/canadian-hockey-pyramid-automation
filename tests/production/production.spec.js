const { test: base, expect } = require('@playwright/test');

const productionUrl = 'https://www.canadianhockeypyramid.com';
const analyticsOrigin = 'https://stats.canadianhockeypyramid.com';

const test = base.extend({
  observed: async ({ page }, use) => {
    const errors = [];
    const mutatingRequests = [];
    await page.addInitScript(origin => {
      const nativeFetch = window.fetch.bind(window);
      const nativeBeacon = typeof navigator.sendBeacon === 'function' ? navigator.sendBeacon.bind(navigator) : null;
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        if (url?.startsWith(origin)) return Promise.resolve(new Response(null, { status: 204 }));
        return nativeFetch(input, init);
      };
      navigator.sendBeacon = (url, data) => String(url).startsWith(origin) ? true : (nativeBeacon ? nativeBeacon(url, data) : false);
    }, analyticsOrigin);
    page.on('pageerror', error => errors.push(`Page error: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`Console error: ${message.text()}`); });
    page.on('requestfailed', request => {
      if (!request.url().startsWith(analyticsOrigin)) errors.push(`Failed request: ${request.method()} ${request.url()}`);
    });
    page.on('request', request => {
      if (request.url().startsWith(productionUrl) && !['GET','HEAD','OPTIONS'].includes(request.method())) {
        mutatingRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    await use({ page, errors, mutatingRequests });
    expect(errors, errors.join('\n')).toEqual([]);
    expect(mutatingRequests, mutatingRequests.join('\n')).toEqual([]);
  }
});

async function openProduction(page) {
  const response = await page.goto(`${productionUrl}/?production-smoke=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  const overlay = page.locator('#p4Overlay');
  if (await overlay.isVisible()) {
    await page.locator('[data-p4-new]').click();
    await expect(overlay).toHaveClass(/hidden/);
  }
}

test('production serves CHP v1.108 with required controls', async ({ observed }) => {
  const { page } = observed;
  await openProduction(page);
  await expect(page.locator('header')).toContainText('v1.108');
  await expect(page.locator('#btnCreateClub')).toBeVisible();
  await expect(page.locator('#btnStats')).toBeVisible();
  await expect(page.locator('#tierTabs button').first()).toBeVisible();
});

test('production supports read-only navigation on desktop and touch profiles', async ({ observed }, testInfo) => {
  const { page } = observed;
  await openProduction(page);
  const d2 = page.getByRole('button', { name: 'D2', exact: true });
  if (testInfo.project.name === 'iphone-chromium') await d2.tap(); else await d2.click();
  await expect(page.locator('#mainView h2')).toContainText('Division 2');
  const stats = page.locator('#btnStats');
  if (testInfo.project.name === 'iphone-chromium') await stats.tap(); else await stats.click();
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
});
