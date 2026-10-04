const {
  test,
  expect,
  openApp,
  activate
} = require('../fixtures/chp-test');

const expectedVersion = process.env.TEST_EXPECTED_VERSION;

if (!expectedVersion) {
  throw new Error('TEST_EXPECTED_VERSION is required.');
}

test('production loads the expected CHP release', async ({
  page,
  criticalErrors
}) => {
  await openApp(page);

  await expect(page).toHaveTitle(/Canadian Hockey Pyramid/i);
  await expect(page.locator('header')).toContainText(v${expectedVersion});
  await expect(page.locator('#mainView')).toBeVisible();
  await expect(page.locator('#tierTabs button').first()).toBeVisible();
});

test('production remains usable after a clean reload', async ({
  page,
  criticalErrors
}) => {
  await openApp(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);

  await expect(page).toHaveTitle(/Canadian Hockey Pyramid/i);
  await expect(page.locator('header')).toContainText(v${expectedVersion});
  await expect(page.locator('#mainView')).toBeVisible();
  await expect(page.locator('#tierTabs button').first()).toBeVisible();
});

test('production division navigation works', async ({
  page,
  criticalErrors
}, testInfo) => {
  await openApp(page);

  const d2 = page.getByRole('button', {
    name: 'D2',
    exact: true
  });

  await expect(d2).toBeVisible();
  await activate(d2, testInfo);

  await expect(page.locator('#mainView h2')).toContainText('Division 2');
  await expect(page.locator('table.standings')).toBeVisible();
});

test('production Statistics opens and closes', async ({
  page,
  criticalErrors
}, testInfo) => {
  await openApp(page);

  await activate(page.locator('#btnStats'), testInfo);

  await expect(
    page.getByRole('heading', {
      name: 'Statistics',
      exact: true
    })
  ).toBeVisible();

  await activate(page.locator('#modalClose'), testInfo);
  await expect(page.locator('#teamModal')).toHaveClass(/hidden/);
});

test('production page shell fits the mobile viewport', async ({
  page,
  criticalErrors
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'iphone-chromium',
    'Mobile-layout assertion'
  );

  await openApp(page);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));

  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});
