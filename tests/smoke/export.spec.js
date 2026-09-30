const { test, expect, openApp, activate } = require('../fixtures/chp-test');

test('idle game generates and triggers a parseable portable JSON save', async ({ page, criticalErrors }, testInfo) => {
  await page.addInitScript(() => {
    window.__chpExportProbe = {
      createObjectURLCalled: false,
      anchorClickCalled: false,
      filename: null,
      href: null,
      blob: null
    };

    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      window.__chpExportProbe.createObjectURLCalled = true;
      window.__chpExportProbe.blob = blob;
      return originalCreateObjectURL(blob);
    };

    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedAnchorClick() {
      window.__chpExportProbe.anchorClickCalled = true;
      window.__chpExportProbe.filename = this.download;
      window.__chpExportProbe.href = this.href;
      return originalAnchorClick.call(this);
    };
  });

  await openApp(page);
  const exportButton = page.locator('#btnExport');
  await expect(exportButton).toBeEnabled();
  await activate(exportButton, testInfo);

  await expect.poll(() => page.evaluate(() => ({
    createObjectURLCalled: window.__chpExportProbe?.createObjectURLCalled,
    anchorClickCalled: window.__chpExportProbe?.anchorClickCalled
  }))).toEqual({
    createObjectURLCalled: true,
    anchorClickCalled: true
  });

  const result = await page.evaluate(async () => {
    const probe = window.__chpExportProbe;
    return {
      filename: probe.filename,
      href: probe.href,
      blobType: probe.blob?.type,
      blobSize: probe.blob?.size,
      text: await probe.blob.text()
    };
  });

  expect(result.filename).toMatch(/^chp-.*\.json$/i);
  expect(result.href).toMatch(/^blob:/);
  expect(result.blobType).toBe('application/json');
  expect(result.blobSize).toBeGreaterThan(0);

  const exported = JSON.parse(result.text);
  expect(exported).toHaveProperty('season');
  expect(exported).toHaveProperty('phase');
  expect(Array.isArray(exported.leagues)).toBeTruthy();

  const activeTeams = exported.leagues.reduce(
    (total, league) => total + (Array.isArray(league.teams) ? league.teams.length : 0),
    0
  );
  expect(activeTeams).toBe(932);
});
