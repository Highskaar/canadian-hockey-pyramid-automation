const {
  test,
  expect,
  installDeterministicRandom,
  installExportCapture,
  openReadyApp,
  createCenturyChallenge,
  exportPortable,
  assertPortableFoundation
} = require('./chpcc-rc-helpers');

test(
  'Century Challenge completes a season, starts the next season and survives reload',
  async ({ observed }) => {
    test.setTimeout(180_000);

    const { page } = observed;

    await installDeterministicRandom(page, 22022);
    await installExportCapture(page);
    await openReadyApp(page);
    await createCenturyChallenge(page);

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Century Challenge · Calgary Flames'
    );

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText('Season 1 of 100');

    const initial = await exportPortable(page);

    assertPortableFoundation(initial.save);

    const initialSeason =
      initial.save.current?.season;

    expect(
      Number.isInteger(initialSeason),
      'The initial portable save must contain a numeric current season.'
    ).toBeTruthy();

    expect(
      initial.save.current?.phase
    ).toBe('regular');

    const initialSummaryCount =
      Array.isArray(initial.save.summaries)
        ? initial.save.summaries.length
        : 0;

    await page
      .locator('[data-sim="season"]')
      .click();

    await expect(
      page.locator('#btnExport')
    ).toBeEnabled({
      timeout: 30_000
    });

    const completed =
      await exportPortable(page);

    assertPortableFoundation(completed.save);

    expect(
      completed.save.current?.season
    ).toBe(initialSeason);

    expect(
      completed.save.current?.phase
    ).toBe('season-complete');

    expect(
      completed.save.current?.post?.stage
    ).toBe('complete');

    expect(
      completed.save.summaries
    ).toHaveLength(
      initialSummaryCount + 1
    );

    expect(
      completed.save.current
        ?.nextLeagueAssignments
    ).toBeTruthy();

    const nextButton = page
      .locator('[data-sim="next"]')
      .first();

    await expect(nextButton).toBeEnabled();

    await nextButton.click();

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Season 2 of 100',
      {
        timeout: 30_000
      }
    );

    const nextSeason =
      await exportPortable(page);

    assertPortableFoundation(nextSeason.save);

    expect(
      nextSeason.save.current?.season
    ).toBe(initialSeason + 1);

    expect(
      nextSeason.save.current?.phase
    ).toBe('regular');

    expect(
      nextSeason.save.current
        ?.nextLeagueAssignments
    ).toBeFalsy();

    expect(
      nextSeason.save.summaries
    ).toHaveLength(
      initialSummaryCount + 1
    );

    await page.reload({
      waitUntil: 'domcontentloaded'
    });

    await page.waitForFunction(
      () =>
        window.CHP_BOOTSTRAP_READY === true
    );

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Century Challenge · Calgary Flames'
    );

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Season 2 of 100'
    );

    const reloaded =
      await exportPortable(page);

    assertPortableFoundation(reloaded.save);

    expect(
      reloaded.save.current?.season
    ).toBe(initialSeason + 1);

    expect(
      reloaded.save.current?.phase
    ).toBe('regular');

    expect(
      reloaded.save.summaries
    ).toHaveLength(
      initialSummaryCount + 1
    );
  }
);
