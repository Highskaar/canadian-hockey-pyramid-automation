const { test, expect, openApp, activate } = require('../fixtures/chp-test');

async function installDeterministicRandom(page, seed = 1108) {
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
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      window.__rcExport.blob = blob;
      return create(blob);
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedClick() {
      window.__rcExport.filename = this.download;
      window.__rcExport.clicks += 1;
      return click.call(this);
    };
  });
}

async function exportPortable(page, testInfo) {
  await expect(page.locator('#btnExport')).toBeEnabled({ timeout: 20_000 });
  await activate(page.locator('#btnExport'), testInfo);
  await expect.poll(() => page.evaluate(() => window.__rcExport?.clicks || 0), {
    timeout: 30_000
  }).toBeGreaterThan(0);
  const result = await page.evaluate(async () => ({
    filename: window.__rcExport.filename,
    text: await window.__rcExport.blob.text()
  }));
  expect(result.filename).toMatch(/^chp-.*\.json$/i);
  return { text: result.text, save: JSON.parse(result.text) };
}

function activeTeamCount(save) {
  if (Array.isArray(save.directory)) return save.directory.length;
  return (save.current?.leagues || save.leagues || []).reduce(
    (sum, league) => sum + (league.teams?.length || 0), 0
  );
}

test('deterministic full-season lifecycle, checkpoint, next season and reload', async ({ page, criticalErrors }, testInfo) => {
  await installDeterministicRandom(page);
  await installExportCapture(page);
  await openApp(page);
  await expect(page.locator('header')).toContainText(`v${process.env.TEST_EXPECTED_VERSION}`);

  const initialSeason = await page.locator('#seasonMenu').textContent();
  expect(initialSeason).toContain('2026/27');

  await activate(page.locator('[data-sim="season"]'), testInfo);
  await expect(page.locator('#btnExport')).toBeEnabled({ timeout: 30_000 });

  const completed = await exportPortable(page, testInfo);
  expect(completed.save.portableSaveVersion).toBe(4);
  expect(activeTeamCount(completed.save)).toBe(932);
  expect(completed.save.current.phase).toBe('season-complete');
  expect(completed.save.current.post?.stage).toBe('complete');
  expect(Array.isArray(completed.save.summaries)).toBeTruthy();
  expect(completed.save.summaries.length).toBeGreaterThanOrEqual(1);
  expect(completed.save.summaries[0]?.season).toBe('2026/27');
  expect(completed.save.current.nextLeagueAssignments).toBeTruthy();

  const nextButton = page.locator('[data-sim="next"]').first();
  await expect(nextButton).toBeEnabled();
  await activate(nextButton, testInfo);
  await expect(page.locator('#seasonMenu')).toContainText('2027/28', { timeout: 30_000 });

  const started = await exportPortable(page, testInfo);
  expect(started.save.current.season).toBe(2027);
  expect(started.save.current.phase).toBe('regular');
  expect(started.save.current.nextLeagueAssignments).toBeFalsy();
  expect(activeTeamCount(started.save)).toBe(932);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await expect(page.locator('#seasonMenu')).toContainText('2027/28');
  const gp = await page.locator('table.standings tbody tr td:nth-child(3)').evaluateAll(cells =>
    cells.map(cell => Number(cell.textContent || 0))
  );
  expect(gp.every(value => value === 0)).toBeTruthy();
});

test('portable save round-trip restores a completed deterministic season', async ({ page, criticalErrors }, testInfo) => {
  await installDeterministicRandom(page, 2208);
  await installExportCapture(page);
  await openApp(page);

  await activate(page.locator('[data-sim="season"]'), testInfo);
  await expect(page.locator('#btnExport')).toBeEnabled({ timeout: 30_000 });
  const exported = await exportPortable(page, testInfo);
  expect(exported.save.current.phase).toBe('season-complete');

  await activate(page.locator('[data-sim="next"]').first(), testInfo);
  await expect(page.locator('#seasonMenu')).toContainText('2027/28', { timeout: 30_000 });

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('Save loaded successfully');
    await dialog.accept();
  });
  await page.locator('#importFile').setInputFiles({
    name: 'automation-release-candidate.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported.text, 'utf8')
  });

  await expect(page.locator('#seasonMenu')).toContainText('2026/27', { timeout: 30_000 });
  await expect(page.locator('[data-sim="next"]').first()).toBeEnabled();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await expect(page.locator('#seasonMenu')).toContainText('2026/27');
});
