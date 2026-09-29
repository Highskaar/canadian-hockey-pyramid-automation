const {
  test,
  expect,
  openApp,
  activate,
  versionAtLeast
} = require('../fixtures/chp-test');

const expectedVersion = process.env.TEST_EXPECTED_VERSION;
const supportsCreateClub =
  process.env.TEST_APPLICATION === 'chp' && versionAtLeast(expectedVersion, '1.108');

test.beforeEach(() => {
  test.skip(!supportsCreateClub, 'Create Club is not expected in this application/version');
});

test('Create Club opens with official-place controls and iPhone-safe inputs', async ({ page, criticalErrors }, testInfo) => {
  await openApp(page);
  const createClub = page.locator('#btnCreateClub');
  await expect(createClub).toBeEnabled();
  await activate(createClub, testInfo);

  await expect(page.getByRole('heading', { name: 'Create Club', exact: true })).toBeVisible();
  const clubName = page.locator('#ccName');
  const place = page.locator('#ccPlace');
  const tier = page.locator('#ccTier');
  await expect(clubName).toBeVisible();
  await expect(place).toBeVisible();
  await expect(tier).toBeVisible();

  for (const input of [clubName, place]) {
    const fontSize = await input.evaluate(element =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  }

  await activate(page.getByRole('button', { name: 'Cancel', exact: true }), testInfo);
  await expect(page.locator('#teamModal')).toHaveClass(/hidden/);
});

test('Create Club previews, commits and persists a deterministic D6 club', async ({ page, criticalErrors }, testInfo) => {
  await openApp(page);
  await activate(page.locator('#btnCreateClub'), testInfo);

  await page.locator('#ccName').fill('Automation Test Club');
  await page.locator('#ccPlace').fill('Toronto');
  const firstPlace = page.locator('#ccPlaces [data-cc-place]').first();
  await expect(firstPlace).toBeVisible();
  await activate(firstPlace, testInfo);
  await expect(page.locator('#ccCoordinates')).toContainText(/Toronto/i);
  await page.locator('#ccTier').selectOption('6');

  await activate(page.locator('#ccPlan'), testInfo);
  await expect(page.locator('#ccPreview')).toContainText('Proposed change');
  await expect(page.locator('#ccPreview')).toContainText('becomes defunct');
  await expect(page.locator('#ccCommit')).toBeEnabled();

  await activate(page.locator('#ccCommit'), testInfo);
  await expect(page.locator('#teamModal')).toHaveClass(/hidden/);
  await expect(page.locator('#btnCreateClub')).toBeDisabled();

  const search = page.locator('#teamSearch');
  await search.fill('Automation Test Club');
  await expect(page.locator('#searchResults')).toContainText('Automation Test Club');

  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
  await page.locator('#teamSearch').fill('Automation Test Club');
  await expect(page.locator('#searchResults')).toContainText('Automation Test Club');
  await expect(page.locator('#btnCreateClub')).toBeDisabled();
});
