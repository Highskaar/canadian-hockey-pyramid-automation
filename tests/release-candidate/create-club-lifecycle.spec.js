const { test, expect, openApp, activate } = require('../fixtures/chp-test');
const {
  installDeterministicRandom,
  installExportCapture,
  exportPortable,
  findDirectoryEntryByName,
  assertPortableIntegrity,
  assertExactCapacities
} = require('./rc-helpers');

const CLUB_NAME = 'Automation Lifecycle Club';

test('custom club survives season transition, export, import and reload', async ({ page, criticalErrors }, testInfo) => {
  test.setTimeout(180_000);
  await installDeterministicRandom(page, 3108);
  await installExportCapture(page);
  await openApp(page);

  await activate(page.locator('#btnCreateClub'), testInfo);
  await page.locator('#ccName').fill(CLUB_NAME);
  await page.locator('#ccPlace').fill('Toronto');
  const place = page.locator('#ccPlaces [data-cc-place]').first();
  await expect(place).toBeVisible();
  await activate(place, testInfo);
  await page.locator('#ccTier').selectOption('6');
  await activate(page.locator('#ccPlan'), testInfo);
  await expect(page.locator('#ccPreview')).toContainText('Proposed change');
  await expect(page.locator('#ccPreview')).toContainText('becomes defunct');
  await activate(page.locator('#ccCommit'), testInfo);
  await expect(page.locator('#teamModal')).toHaveClass(/hidden/);

  const created = await exportPortable(page, activate, testInfo);
  assertPortableIntegrity(created.save, 2026, 'regular');
  assertExactCapacities(created.save);
  const createdEntry = findDirectoryEntryByName(created.save, CLUB_NAME);
  expect(createdEntry).toBeTruthy();
  const customId = createdEntry[0];
  expect(created.save.current.activeTeamIds).toContain(customId);

  await activate(page.locator('[data-sim="season"]'), testInfo);
  const completed = await exportPortable(page, activate, testInfo);
  assertPortableIntegrity(completed.save, 2026, 'season-complete');
  expect(findDirectoryEntryByName(completed.save, CLUB_NAME)?.[0]).toBe(customId);
  expect(completed.save.summaries).toHaveLength(1);

  await activate(page.locator('[data-sim="next"]').first(), testInfo);
  await expect(page.locator('#seasonMenu')).toContainText('2027/28', { timeout: 30_000 });
  const nextSeason = await exportPortable(page, activate, testInfo);
  assertPortableIntegrity(nextSeason.save, 2027, 'regular');
  assertExactCapacities(nextSeason.save);
  expect(findDirectoryEntryByName(nextSeason.save, CLUB_NAME)?.[0]).toBe(customId);
  expect(nextSeason.save.current.activeTeamIds).toContain(customId);

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('Save loaded successfully');
    await dialog.accept();
  });
  await page.locator('#importFile').setInputFiles({
    name: 'custom-club-lifecycle.json',
    mimeType: 'application/json',
    buffer: Buffer.from(completed.text, 'utf8')
  });
  await expect(page.locator('#seasonMenu')).toContainText('2026/27', { timeout: 30_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await page.locator('#teamSearch').fill(CLUB_NAME);
  await expect(page.locator('#searchResults')).toContainText(CLUB_NAME);
  await expect(page.locator('[data-sim="next"]').first()).toBeEnabled();
});
