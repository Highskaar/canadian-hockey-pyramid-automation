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
  'Century Challenge portable saves remain coherent across season phases',
  async ({ observed }) => {
    test.setTimeout(180_000);

    const { page } = observed;

    await installDeterministicRandom(
      page,
      32022
    );

    await installExportCapture(page);
    await openReadyApp(page);
    await createCenturyChallenge(page);

    const fresh = await exportPortable(page);

    assertPortableFoundation(fresh.save);

    const initialSeason =
      fresh.save.current?.season;

    expect(
      Number.isInteger(initialSeason),
      'The initial save must contain a numeric current season.'
    ).toBeTruthy();

    expect(
      fresh.save.current?.phase
    ).toBe('regular');

    const initialSummaryCount =
      Array.isArray(fresh.save.summaries)
        ? fresh.save.summaries.length
        : 0;

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Century Challenge · Calgary Flames'
    );

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText('Season 1 of 100');

    await page
      .locator('[data-sim="regular"]')
      .click();

    await expect(
      page.locator('#btnExport')
    ).toBeEnabled({
      timeout: 30_000
    });

    const regularComplete =
      await exportPortable(page);

    assertPortableFoundation(
      regularComplete.save
    );

    expect(
      regularComplete.save.current?.season
    ).toBe(initialSeason);

    expect(
      regularComplete.save.current?.phase
    ).toBe('regular-complete');

    expect(
      regularComplete.save.current?.post
    ).toBeNull();

    expect(
      regularComplete.save.current
        ?.cup?.complete
    ).toBeFalsy();

    expect(
      regularComplete.save.summaries
    ).toHaveLength(
      initialSummaryCount
    );

    await page
      .locator('[data-sim="season"]')
      .click();

    await expect(
      page.locator('#btnExport')
    ).toBeEnabled({
      timeout: 30_000
    });

    const seasonComplete =
      await exportPortable(page);

    assertPortableFoundation(
      seasonComplete.save
    );

    expect(
      seasonComplete.save.current?.season
    ).toBe(initialSeason);

    expect(
      seasonComplete.save.current?.phase
    ).toBe('season-complete');

    expect(
      seasonComplete.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      seasonComplete.save.summaries
    ).toHaveLength(
      initialSummaryCount + 1
    );

    expect(
      seasonComplete.save.current
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

    assertPortableFoundation(
      nextSeason.save
    );

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
  }
);
