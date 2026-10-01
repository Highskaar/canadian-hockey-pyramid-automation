const { test, expect, openApp, activate } = require('../fixtures/chp-test');
const {
  installDeterministicRandom,
  installExportCapture,
  exportPortable,
  assertPortableIntegrity
} = require('./rc-helpers');

test('portable saves are coherent before and after regular-season completion', async ({ page, criticalErrors }, testInfo) => {
  test.setTimeout(180_000);
  await installDeterministicRandom(page, 6108);
  await installExportCapture(page);
  await openApp(page);

  const fresh = await exportPortable(page, activate, testInfo);
  assertPortableIntegrity(fresh.save, 2026, 'regular');
  expect(fresh.save.summaries).toHaveLength(0);

  await activate(page.locator('[data-sim="regular"]'), testInfo);
  const regularComplete = await exportPortable(page, activate, testInfo);
  assertPortableIntegrity(regularComplete.save, 2026, 'regular-complete');
  expect(regularComplete.save.current.post).toBeNull();
  expect(regularComplete.save.current.cup?.complete).toBeFalsy();
  expect(regularComplete.save.summaries).toHaveLength(0);

  await activate(page.locator('[data-sim="season"]'), testInfo);
  const seasonComplete = await exportPortable(page, activate, testInfo);
  assertPortableIntegrity(seasonComplete.save, 2026, 'season-complete');
  expect(seasonComplete.save.current.post?.stage).toBe('complete');
  expect(seasonComplete.save.summaries).toHaveLength(1);
});
