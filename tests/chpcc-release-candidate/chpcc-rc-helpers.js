const { test: base, expect } = require('@playwright/test');

const analyticsOrigin =
  'https://stats.canadianhockeypyramid.com';

const expectedVersion =
  process.env.TEST_EXPECTED_VERSION;

if (!expectedVersion) {
  throw new Error('TEST_EXPECTED_VERSION is required.');
}

const test = base.extend({
  observed: async ({ page }, use) => {
    const errors = [];

    await page.addInitScript(origin => {
      const originalFetch =
        window.fetch.bind(window);

      const originalSendBeacon =
        typeof navigator.sendBeacon === 'function'
          ? navigator.sendBeacon.bind(navigator)
          : null;

      window.fetch = (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input?.url;

        if (url?.startsWith(origin)) {
          return Promise.resolve(
            new Response(null, { status: 204 })
          );
        }

        return originalFetch(input, init);
      };

      navigator.sendBeacon = (url, data) => {
        if (String(url).startsWith(origin)) {
          return true;
        }

        return originalSendBeacon
          ? originalSendBeacon(url, data)
          : false;
      };
    }, analyticsOrigin);

    page.on('pageerror', error => {
      errors.push(
        `Uncaught page error: ${error.message}`
      );
    });

    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(
          `Console error: ${message.text()}`
        );
      }
    });

    page.on('requestfailed', request => {
      if (
        request.url().startsWith(analyticsOrigin)
      ) {
        return;
      }

      const failure = request.failure();

      errors.push(
        `Failed request: ${request.method()} ` +
        `${request.url()} ` +
        `(${failure?.errorText || 'unknown error'})`
      );
    });

    await use({ page, errors });

    expect(
      errors,
      errors.join('\n')
    ).toEqual([]);
  }
});

async function installDeterministicRandom(
  page,
  seed
) {
  await page.addInitScript(initialSeed => {
    let state = initialSeed >>> 0;

    Math.random = () => {
      state = (
        Math.imul(1664525, state) +
        1013904223
      ) >>> 0;

      return state / 4294967296;
    };
  }, seed);
}

async function installExportCapture(page) {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(
        window,
        'showSaveFilePicker',
        {
          configurable: true,
          value: undefined
        }
      );
    } catch {
      try {
        delete window.showSaveFilePicker;
      } catch {}
    }

    window.__chpccRcExport = {
      blob: null,
      filename: null,
      clicks: 0
    };

    const originalCreateObjectURL =
      URL.createObjectURL.bind(URL);

    URL.createObjectURL = blob => {
      window.__chpccRcExport.blob = blob;
      return originalCreateObjectURL(blob);
    };

    const originalAnchorClick =
      HTMLAnchorElement.prototype.click;

    HTMLAnchorElement.prototype.click =
      function patchedAnchorClick() {
        window.__chpccRcExport.filename =
          this.download;

        window.__chpccRcExport.clicks += 1;

        return originalAnchorClick.call(this);
      };
  });
}

async function openCHPCC(page) {
  const response = await page.goto('/', {
    waitUntil: 'domcontentloaded'
  });

  expect(
    response,
    'The CHPCC main document did not return a response'
  ).not.toBeNull();

  expect(
    response.ok(),
    `CHPCC main document returned HTTP ` +
      `${response.status()}`
  ).toBeTruthy();

  await page.waitForFunction(
    () => window.CHP_BOOTSTRAP_READY === true
  );

  await expect(
    page.locator('body')
  ).toContainText(`v${expectedVersion}`);
}

async function dismissIntro(page) {
  const overlay = page.locator('#p4Overlay');

  if (
    await overlay
      .isVisible()
      .catch(() => false)
  ) {
    const dontShowAgain =
      page.locator('[data-p4-dont]');

    if (
      await dontShowAgain
        .isVisible()
        .catch(() => false)
    ) {
      await dontShowAgain.check();
    }

    await page
      .locator('[data-p4-new]')
      .click();

    await expect(overlay).toBeHidden();
  }
}

async function openReadyApp(page) {
  await openCHPCC(page);
  await dismissIntro(page);

  await expect(
    page.locator('#mainView')
  ).toBeVisible();
}

async function createCenturyChallenge(
  page,
  options = {}
) {
  const {
    club = 'calgary_flames',
    tier = '1'
  } = options;

  await page.locator('#btnGameMode').click();

  await expect(
    page.locator('#challengeModal')
  ).toBeVisible();

  await page
    .locator('[data-cc-club]')
    .selectOption(club);

  await page
    .locator('[data-cc-tier]')
    .selectOption(tier);

  await page
    .locator('[data-cc-begin]')
    .click();

  await expect(
    page.locator('#challengeModal')
  ).toBeHidden();

  await expect(
    page.locator('#challengeDashboard')
  ).toBeVisible();

  await expect(
    page.locator('#challengeDashboard')
  ).toContainText('Season 1 of 100');
}

async function exportPortable(page) {
  const button = page.locator('#btnExport');

  await expect(button).toBeEnabled({
    timeout: 30_000
  });

  const previousClicks =
    await page.evaluate(
      () =>
        window.__chpccRcExport?.clicks || 0
    );

  await button.click();

  await expect.poll(
    () =>
      page.evaluate(
        () =>
          window.__chpccRcExport?.clicks || 0
      ),
    { timeout: 30_000 }
  ).toBeGreaterThan(previousClicks);

  const result = await page.evaluate(
    async () => {
      const capture =
        window.__chpccRcExport;

      if (!capture?.blob) {
        throw new Error(
          'No portable-save Blob was captured.'
        );
      }

      return {
        filename: capture.filename,
        text: await capture.blob.text()
      };
    }
  );

  expect(result.filename).toBeTruthy();

  expect(result.filename).toMatch(
    /\.json$/i
  );

  return {
    filename: result.filename,
    text: result.text,
    save: JSON.parse(result.text)
  };
}

function directoryEntries(save) {
  return Array.isArray(save.directory)
    ? save.directory
    : [];
}

function directoryIds(save) {
  return directoryEntries(save).map(
    entry => entry[0]
  );
}

function assertDirectoryIntegrity(save) {
  expect(directoryEntries(save)).toHaveLength(
    932
  );

  const ids = directoryIds(save);

  expect(new Set(ids).size).toBe(932);

  expect(
    save.current?.activeTeamIds
  ).toHaveLength(932);

  expect(
    new Set(save.current.activeTeamIds).size
  ).toBe(932);

  expect(
    new Set(save.current.activeTeamIds)
  ).toEqual(new Set(ids));
}

function assertExactCapacities(save) {
  const leagues =
    save.current?.leagues || [];

  expect(leagues).toHaveLength(64);

  const expectedSizes = new Map([
    [1, 20],
    [2, 20],
    [3, 20],
    [4, 16],
    [5, 14],
    [6, 14]
  ]);

  const tierCounts = new Map();

  for (const league of leagues) {
    const expectedSize =
      expectedSizes.get(league.tier);

    expect(
      expectedSize,
      `Unexpected tier ${league.tier}`
    ).toBeTruthy();

    expect(league.teams).toHaveLength(
      expectedSize
    );

    tierCounts.set(
      league.tier,
      (tierCounts.get(league.tier) || 0) + 1
    );
  }

  expect(
    Object.fromEntries(tierCounts)
  ).toEqual({
    1: 1,
    2: 1,
    3: 2,
    4: 6,
    5: 18,
    6: 36
  });
}

function assertPortableFoundation(save) {
  expect(save.portableSaveVersion).toBe(4);
  expect(save.current).toBeTruthy();
  assertDirectoryIntegrity(save);
  assertExactCapacities(save);
}

module.exports = {
  test,
  expect,
  installDeterministicRandom,
  installExportCapture,
  openCHPCC,
  dismissIntro,
  openReadyApp,
  createCenturyChallenge,
  exportPortable,
  directoryEntries,
  directoryIds,
  assertDirectoryIntegrity,
  assertExactCapacities,
  assertPortableFoundation
};
