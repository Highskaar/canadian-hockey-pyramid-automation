const fs = require('node:fs/promises');
const { test, expect, openApp, activate } = require('../fixtures/chp-test');

test('idle game exports a parseable portable JSON save', async ({ page, criticalErrors }, testInfo) => {
  await openApp(page);
  const exportButton = page.locator('#btnExport');
  await expect(exportButton).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await activate(exportButton, testInfo);
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/i);

  const path = await download.path();
  expect(path).toBeTruthy();
  const exported = JSON.parse(await fs.readFile(path, 'utf8'));

  expect(exported).toHaveProperty('season');
  expect(exported).toHaveProperty('phase');
  expect(Array.isArray(exported.leagues)).toBeTruthy();
  const activeTeams = exported.leagues.reduce(
    (total, league) => total + (Array.isArray(league.teams) ? league.teams.length : 0),
    0
  );
  expect(activeTeams).toBe(932);
});
