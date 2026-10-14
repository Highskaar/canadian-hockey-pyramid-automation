const { test, expect } = require('@playwright/test');

const analyticsOrigin =
  'https://stats.canadianhockeypyramid.com';
const expectedVersion =
  process.env.TEST_EXPECTED_VERSION;

if (!expectedVersion) {
  throw new Error('TEST_EXPECTED_VERSION is required.');
}

async function installAnalyticsProbe(page) {
  await page.addInitScript(origin => {
    const nativeFetch =
      window.fetch.bind(window);

    window.__chpccAnalyticsProbe = {
      requests: [],
      reject: false
    };

    window.fetch = (input, init = {}) => {
      const url =
        typeof input === 'string'
          ? input
          : input?.url;

      if (url?.startsWith(origin)) {
        let body = null;
        try {
          body = JSON.parse(init.body);
        } catch {}

        window.__chpccAnalyticsProbe.requests.push({
          url,
          method: init.method,
          credentials: init.credentials,
          mode: init.mode,
          keepalive: init.keepalive,
          contentType:
            init.headers?.['Content-Type'] ||
            init.headers?.get?.('Content-Type') ||
            null,
          body
        });

        if (window.__chpccAnalyticsProbe.reject) {
          return Promise.reject(
            new TypeError('Synthetic analytics outage')
          );
        }

        return Promise.resolve(
          new Response(null, { status: 204 })
        );
      }

      return nativeFetch(input, init);
    };
  }, analyticsOrigin);
}

async function openCHPCC(page) {
  const response = await page.goto('/', {
    waitUntil: 'domcontentloaded'
  });

  expect(
    response,
    'The CHPCC main document did not return a response.'
  ).not.toBeNull();
  expect(response.ok()).toBeTruthy();

  await page.waitForFunction(
    () => window.CHP_BOOTSTRAP_READY === true
  );

  await expect(page.locator('body')).toContainText(
    `v${expectedVersion}`
  );
}

async function dismissIntro(page) {
  const overlay = page.locator('#p4Overlay');
  if (await overlay.isVisible().catch(() => false)) {
    await page.locator('[data-p4-new]').click();
    await expect(overlay).toBeHidden();
  }
}

async function requests(page) {
  return page.evaluate(
    () => window.__chpccAnalyticsProbe?.requests || []
  );
}

function expectPrivateAggregateRequest(request, event) {
  expect(request.url).toBe(
    `${analyticsOrigin}/event`
  );
  expect(request.method).toBe('POST');
  expect(request.credentials).toBe('omit');
  expect(request.mode).toBe('cors');
  expect(request.keepalive).toBe(true);
  expect(request.contentType).toBe(
    'application/json'
  );
  expect(request.body).toEqual({
    event,
    app_version: 'v0.22'
  });
  expect(
    Object.keys(request.body).sort()
  ).toEqual([
    'app_version',
    'event'
  ]);
}

test.beforeEach(async ({ page }) => {
  await installAnalyticsProbe(page);
});

test(
  'CHPCC analytics exposes only the approved aggregate contract',
  async ({ page }) => {
    await openCHPCC(page);

    await expect.poll(
      async () => (await requests(page)).length
    ).toBeGreaterThan(0);

    const initialRequests = await requests(page);
    const created = initialRequests.find(
      request => request.body?.event === 'game_created'
    );

    expect(created).toBeTruthy();
    expectPrivateAggregateRequest(
      created,
      'game_created'
    );

    const contract = await page.evaluate(() => ({
      exists: Boolean(window.CHPAnalytics),
      appVersion: window.CHPAnalytics?.appVersion,
      rejected:
        window.CHPAnalytics?.emit(
          'not_an_allowed_event',
          'rejected-probe'
        ),
      first:
        window.CHPAnalytics?.emit(
          'save_import_completed',
          'dedupe-probe'
        ),
      duplicate:
        window.CHPAnalytics?.emit(
          'save_import_completed',
          'dedupe-probe'
        )
    }));

    expect(contract).toEqual({
      exists: true,
      appVersion: 'v0.22',
      rejected: false,
      first: true,
      duplicate: false
    });

    await expect.poll(
      async () => (await requests(page)).filter(
        request =>
          request.body?.event ===
          'save_import_completed'
      ).length
    ).toBe(1);

    const finalRequests = await requests(page);
    expect(
      finalRequests.some(
        request =>
          request.body?.event ===
          'not_an_allowed_event'
      )
    ).toBe(false);

    for (const request of finalRequests) {
      expect(
        [
          'game_created',
          'season_completed',
          'next_season_started',
          'save_export_completed',
          'save_import_completed'
        ]
      ).toContain(request.body?.event);
      expectPrivateAggregateRequest(
        request,
        request.body.event
      );
    }
  }
);

test(
  'Century Challenge creation persists when analytics delivery fails',
  async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await openCHPCC(page);
    await dismissIntro(page);

    await page.evaluate(() => {
      window.__chpccAnalyticsProbe.reject = true;
    });

    const before = (await requests(page)).length;

    await page.locator('#btnGameMode').click();
    await expect(
      page.locator('#challengeModal')
    ).toBeVisible();
    await page
      .locator('[data-cc-club]')
      .selectOption('calgary_flames');
    await page
      .locator('[data-cc-tier]')
      .selectOption('1');
    await page
      .locator('[data-cc-begin]')
      .click();

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Century Challenge · Calgary Flames'
    );
    await expect(
      page.locator('#challengeDashboard')
    ).toContainText('Season 1 of 100');

    await expect.poll(
      async () => (await requests(page)).length
    ).toBeGreaterThan(before);

    const challengeCreated =
      (await requests(page)).at(-1);
    expectPrivateAggregateRequest(
      challengeCreated,
      'game_created'
    );

    await page.reload({
      waitUntil: 'domcontentloaded'
    });
    await page.waitForFunction(
      () => window.CHP_BOOTSTRAP_READY === true
    );

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Century Challenge · Calgary Flames'
    );
    await expect(
      page.locator('#challengeDashboard')
    ).toContainText('Season 1 of 100');

    expect(errors).toEqual([]);
  }
);
