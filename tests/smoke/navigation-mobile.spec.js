const { test, expect, openApp, activate } = require('../fixtures/chp-test');

const expectedVersion = process.env.TEST_EXPECTED_VERSION;

test('deployment shows the expected version', async ({ page, criticalErrors }) => {
  await openApp(page);
  await expect(page.locator('header')).toContainText(`v${expectedVersion}`);
});

test('core division navigation works with desktop and touch input', async ({ page, criticalErrors }, testInfo) => {
  await openApp(page);
  const d2 = page.getByRole('button', { name: 'D2', exact: true });
  await expect(d2).toBeVisible();
  await activate(d2, testInfo);
  await expect(page.locator('#mainView h2')).toContainText('Division 2');
});

test('Statistics opens and closes', async ({ page, criticalErrors }, testInfo) => {
  await openApp(page);
  await activate(page.locator('#btnStats'), testInfo);
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
  await activate(page.locator('#modalClose'), testInfo);
  await expect(page.locator('#teamModal')).toHaveClass(/hidden/);
});

test('page shell does not overflow the mobile viewport', async ({ page, criticalErrors }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-chromium', 'Mobile-layout assertion');
  await openApp(page);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});
