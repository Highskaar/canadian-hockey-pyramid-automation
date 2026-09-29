const { test, expect, openApp } = require('../fixtures/chp-test');

test('deployment loads as the Canadian Hockey Pyramid application', async ({ page, criticalErrors }) => {
  await openApp(page);
  await expect(page).toHaveTitle(/Canadian Hockey Pyramid/i);
  await expect(page.locator('body')).not.toBeEmpty();
});

test('deployment remains usable after a clean reload', async ({ page, criticalErrors }) => {
  await openApp(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await expect(page).toHaveTitle(/Canadian Hockey Pyramid/i);
  await expect(page.locator('#mainView')).toBeVisible();
});
