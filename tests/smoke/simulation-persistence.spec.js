const {
  test,
  expect,
  openApp,
  activate,
  sumVisibleGamesPlayed
} = require('../fixtures/chp-test');

test('one-game simulation updates standings, persists, and locks Create Club', async ({ page, criticalErrors }, testInfo) => {
  await openApp(page);
  await expect(page.locator('#btnCreateClub')).toBeEnabled();

  const before = await sumVisibleGamesPlayed(page);
  expect(before).toBe(0);

  const oneGame = page.locator('[data-sim="one"]');
  await expect(oneGame).toBeEnabled();
  await activate(oneGame, testInfo);

  await expect.poll(() => sumVisibleGamesPlayed(page)).toBeGreaterThan(before);
  await expect(oneGame).toBeEnabled();
  await expect(page.locator('#btnCreateClub')).toBeDisabled();
  const after = await sumVisibleGamesPlayed(page);

  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await expect.poll(() => sumVisibleGamesPlayed(page)).toBe(after);
  await expect(page.locator('#btnCreateClub')).toBeDisabled();
});
