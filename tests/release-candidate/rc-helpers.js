const { expect } = require('@playwright/test');

async function installDeterministicRandom(page, seed) {
  await page.addInitScript(initialSeed => {
    let state = initialSeed >>> 0;
    Math.random = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }, seed);
}

async function installExportCapture(page) {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: undefined
      });
    } catch {
      try { delete window.showSaveFilePicker; } catch {}
    }

    window.__rcExport = { blob: null, filename: null, clicks: 0 };
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      window.__rcExport.blob = blob;
      return createObjectURL(blob);
    };

    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedAnchorClick() {
      window.__rcExport.filename = this.download;
      window.__rcExport.clicks += 1;
      return anchorClick.call(this);
    };
  });
}

async function exportPortable(page, activate, testInfo) {
  const button = page.locator('#btnExport');
  await expect(button).toBeEnabled({ timeout: 30_000 });
  const previousClicks = await page.evaluate(() => window.__rcExport?.clicks || 0);
  await activate(button, testInfo);
  await expect.poll(
    () => page.evaluate(() => window.__rcExport?.clicks || 0),
    { timeout: 30_000 }
  ).toBeGreaterThan(previousClicks);

  const result = await page.evaluate(async () => ({
    filename: window.__rcExport.filename,
    text: await window.__rcExport.blob.text()
  }));
  expect(result.filename).toMatch(/^chp-.*\.json$/i);
  return { text: result.text, save: JSON.parse(result.text) };
}

function directoryEntries(save) {
  return Array.isArray(save.directory) ? save.directory : [];
}

function directoryIds(save) {
  return directoryEntries(save).map(entry => entry[0]);
}

function findDirectoryEntryByName(save, name) {
  return directoryEntries(save).find(entry => entry[1]?.[0] === name);
}

function assertPortableIntegrity(save, expectedSeason, expectedPhase) {
  expect(save.portableSaveVersion).toBe(4);
  expect(save.current?.season).toBe(expectedSeason);
  expect(save.current?.phase).toBe(expectedPhase);
  expect(directoryEntries(save)).toHaveLength(932);
  const ids = directoryIds(save);
  expect(new Set(ids).size).toBe(932);
  expect(save.current?.activeTeamIds).toHaveLength(932);
  expect(new Set(save.current.activeTeamIds).size).toBe(932);
  expect(new Set(save.current.activeTeamIds)).toEqual(new Set(ids));
}

function assertExactCapacities(save) {
  const leagues = save.current?.leagues || [];
  expect(leagues).toHaveLength(64);
  const expected = new Map([[1,20],[2,20],[3,20],[4,16],[5,14],[6,14]]);
  const counts = new Map();
  for (const league of leagues) {
    counts.set(league.tier, (counts.get(league.tier) || 0) + 1);
    expect(league.teams).toHaveLength(expected.get(league.tier));
  }
  expect(Object.fromEntries(counts)).toEqual({1:1,2:1,3:2,4:6,5:18,6:36});
}

module.exports = {
  installDeterministicRandom,
  installExportCapture,
  exportPortable,
  findDirectoryEntryByName,
  assertPortableIntegrity,
  assertExactCapacities
};
