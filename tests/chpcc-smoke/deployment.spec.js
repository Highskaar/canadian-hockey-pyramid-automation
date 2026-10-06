const { test: base, expect } = require('@playwright/test');

const expectedVersion = process.env.TEST_EXPECTED_VERSION;
const analyticsOrigin = 'https://stats.canadianhockeypyramid.com';

if (!expectedVersion) {
  throw new Error('TEST_EXPECTED_VERSION is required.');
}

const test = base.extend({
  observed: async ({ page }, use) => {
    const errors = [];

    await page.addInitScript(origin => {
      const originalFetch = window.fetch.bind(window);
      const originalSendBeacon =
        typeof navigator.sendBeacon === 'function'
          ? navigator.sendBeacon.bind(navigator)
          : null;

      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;

        if (url?.startsWith(origin)) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        return originalFetch(input, init);
      };

      navigator.sendBeacon = (url, data) => {
        if (String(url).startsWith(origin)) {
          return true;
        }

        return originalSendBeacon ? originalSendBeacon(url, data) : false;
      };
    }, analyticsOrigin);

    page.on('pageerror', error => {
      errors.push(`Uncaught page error: ${error.message}`);
    });

    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(`Console error: ${message.text()}`);
      }
    });

    page.on('requestfailed', request => {
      if (request.url().startsWith(analyticsOrigin)) {
        return;
      }

      const failure = request.failure();
      errors.push(
        `Failed request: ${request.method()} ${request.url()} ` +
        `(${failure?.errorText || 'unknown error'})`
      );
    });

    await use({ page, errors });

    expect(errors, errors.join('\n')).toEqual([]);
  }
});

async function openCHPCC(page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

  expect(
    response,
    'The CHPCC main document did not return a response'
  ).not.toBeNull();

  expect(
    response.ok(),
    `CHPCC main document returned HTTP ${response.status()}`
  ).toBeTruthy();

  await expect(page.locator('body')).not.toBeEmpty();
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
}

async function dismissIntro(page) {
  const overlay = page.locator('#p4Overlay');

  if (await overlay.isVisible().catch(() => false)) {
    await page.locator('[data-p4-new]').click();
    await expect(overlay).toBeHidden();
  }
}

async function openReadyApp(page) {
  await openCHPCC(page);
  await dismissIntro(page);
  await expect(page.locator('#mainView')).toBeVisible();
}

function firstGamesPlayedCell(page) {
  return page.locator('#mainView .standings tbody tr').first().locator('td').nth(2);
}

test('CHPCC deployment loads the expected release', async ({ observed }) => {
  const { page } = observed;

  await openCHPCC(page);
  await expect(page.locator('body')).toContainText(`v${expectedVersion}`);
});

test('CHPCC deployment remains available after reload', async ({ observed }) => {
  const { page } = observed;

  await openCHPCC(page);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.locator('body')).toContainText(`v${expectedVersion}`);
});

test('intro can be dismissed and stays dismissed after reload', async ({ observed }) => {
  const { page } = observed;

  await openCHPCC(page);
  await expect(page.locator('#p4Overlay')).toBeVisible();
  await page.locator('[data-p4-dont]').check();
  await page.locator('[data-p4-new]').click();
  await expect(page.locator('#p4Overlay')).toBeHidden();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await expect(page.locator('#p4Overlay')).toBeHidden();
  await expect(page.locator('#mainView')).toBeVisible();
});

test('primary league and Cup navigation works', async ({ observed }) => {
  const { page } = observed;

  await openReadyApp(page);

  await page.locator('[data-tier="2"]').click();
  await expect(page.locator('#mainView')).toContainText('Division 2');

  await page.locator('[data-cup-tab]').click();
  await expect(page.locator('#mainView')).toContainText('1867 Cup');
  await expect(page.locator('[data-cup-tab]')).toHaveClass(/active/);

  await page.locator('[data-tier="1"]').click();
  await expect(page.locator('#mainView')).toContainText(
    'Canadian Hockey Championship'
  );
});

test('statistics view opens and closes with meaningful content', async ({ observed }) => {
  const { page } = observed;

  await openReadyApp(page);
  await page.locator('#btnStats').click();

  await expect(page.locator('#teamModal')).toBeVisible();
  await expect(page.locator('#teamModal')).toContainText('Statistics');
  await expect(page.locator('#teamModal')).toContainText('Most CHC titles');

  await page.locator('#modalClose').click();
  await expect(page.locator('#teamModal')).toBeHidden();
});

test('Century Challenge can be created with its dashboard', async ({ observed }) => {
  const { page } = observed;

  await openReadyApp(page);
  await page.locator('#btnGameMode').click();
  await expect(page.locator('#challengeModal')).toBeVisible();

  await page.locator('[data-cc-club]').selectOption('calgary_flames');
  await page.locator('[data-cc-tier]').selectOption('1');
  await page.locator('[data-cc-begin]').click();

  await expect(page.locator('#challengeModal')).toBeHidden();
  await expect(page.locator('#challengeDashboard')).toBeVisible();
  await expect(page.locator('#challengeDashboard')).toContainText(
    'Century Challenge · Calgary Flames'
  );
  await expect(page.locator('#challengeDashboard')).toContainText(
    'Season 1 of 100'
  );
});

test('Century Challenge creation persists after reload', async ({ observed }) => {
  const { page } = observed;

  await openReadyApp(page);
  await page.locator('#btnGameMode').click();
  await page.locator('[data-cc-club]').selectOption('calgary_flames');
  await page.locator('[data-cc-tier]').selectOption('1');
  await page.locator('[data-cc-begin]').click();
  await expect(page.locator('#challengeDashboard')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);

  await expect(page.locator('#challengeDashboard')).toContainText(
    'Century Challenge · Calgary Flames'
  );
  await expect(page.locator('#challengeDashboard')).toContainText(
    'Season 1 of 100'
  );
});

test('one-game simulation changes standings and survives reload', async ({ observed }) => {
  const { page } = observed;

  await openReadyApp(page);
  await expect(firstGamesPlayedCell(page)).toHaveText('0');

  await page.locator('[data-sim="one"]').click();
  await expect(firstGamesPlayedCell(page)).toHaveText('1');
  await page.waitForTimeout(1200);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await expect(firstGamesPlayedCell(page)).toHaveText('1');
});
