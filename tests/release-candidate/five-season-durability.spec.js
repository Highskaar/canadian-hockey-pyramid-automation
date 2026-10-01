const { test, expect, openApp, activate } = require('../fixtures/chp-test');
const {
  installDeterministicRandom,
  installExportCapture,
  exportPortable,
  assertPortableIntegrity,
  assertExactCapacities
} = require('./rc-helpers');

test('five deterministic seasons preserve competition, history and storage invariants', async ({ page, criticalErrors }, testInfo) => {
  test.setTimeout(300_000);
  await installDeterministicRandom(page, 5108);
  await installExportCapture(page);
  await openApp(page);

  for (let completed = 0; completed < 5; completed += 1) {
    const season = 2026 + completed;
    await activate(page.locator('[data-sim="season"]'), testInfo);
    const endState = await exportPortable(page, activate, testInfo);
    assertPortableIntegrity(endState.save, season, 'season-complete');
    assertExactCapacities(endState.save);
    expect(endState.save.current.post?.stage).toBe('complete');
    expect(endState.save.summaries).toHaveLength(completed + 1);
    expect(endState.save.histories).toHaveLength(932);
    for (const [, history] of endState.save.histories) {
      expect(history.history).toHaveLength(completed + 1);
    }
    expect(endState.save.current.nextLeagueAssignments).toBeTruthy();

    if (completed < 4) {
      await activate(page.locator('[data-sim="next"]').first(), testInfo);
      await expect(page.locator('#seasonMenu')).toContainText(`${season + 1}/`, { timeout: 30_000 });
      const newSeason = await exportPortable(page, activate, testInfo);
      assertPortableIntegrity(newSeason.save, season + 1, 'regular');
      assertExactCapacities(newSeason.save);
      expect(newSeason.save.current.nextLeagueAssignments).toBeFalsy();
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await expect(page.locator('#seasonMenu')).toContainText('2030/31');
  await expect(page.locator('[data-sim="next"]').first()).toBeEnabled();
});
