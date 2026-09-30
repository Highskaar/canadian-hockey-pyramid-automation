const { test, expect, openApp, activate } = require('../fixtures/chp-test');

test('idle game generates and triggers a parseable portable JSON save', async ({ page, criticalErrors }, testInfo) => {
  await page.addInitScript(() => {
    // Headless Chromium exposes the desktop file picker API, but GitHub's runner
    // cannot interact with the native picker. Remove it before CHP loads so the
    // application's supported Blob-download fallback is exercised instead.
    try {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: undefined
      });
    } catch {
      try { delete window.showSaveFilePicker; } catch {}
    }

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
  await expect.poll(() => page.evaluate(() => typeof window.showSaveFilePicker)).toBe('undefined');

  const exportButton = page.locator('#btnExport');
  await expect(exportButton).toBeEnabled();
  await activate(exportButton, testInfo);

  await expect.poll(() => page.evaluate(() => ({
    createObjectURLCalled: window.__chpExportProbe?.createObjectURLCalled,
    anchorClickCalled: window.__chpExportProbe?.anchorClickCalled
  })), { timeout: 20_000 }).toEqual({
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
  expect(exported).toHaveProperty('portableSaveVersion', 4);
  expect(exported).toHaveProperty('current');
  expect(exported).toHaveProperty('directory');
  expect(Array.isArray(exported.directory)).toBeTruthy();
  expect(exported.directory).toHaveLength(932);
});
