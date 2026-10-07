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
  'Century Challenge export and import restores a completed season',
  async ({ observed }) => {
    test.setTimeout(180_000);

    const { page } = observed;

    await installDeterministicRandom(
      page,
      42022
    );

    await installExportCapture(page);
    await openReadyApp(page);
    await createCenturyChallenge(page);

    const initial = await exportPortable(page);

    assertPortableFoundation(initial.save);

    const initialSeason =
      initial.save.current?.season;

    expect(
      Number.isInteger(initialSeason),
      'The initial save must contain a numeric current season.'
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
      completed.save.current
        ?.post?.stage
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

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText('Season 1 of 100');

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

    const advanced =
      await exportPortable(page);

    assertPortableFoundation(advanced.save);

    expect(
      advanced.save.current?.season
    ).toBe(initialSeason + 1);

    expect(
      advanced.save.current?.phase
    ).toBe('regular');

    page.once(
      'dialog',
      async dialog => {
        expect(
          dialog.message()
        ).toContain(
          'Save loaded successfully'
        );

        await dialog.accept();
      }
    );

    await page
      .locator('#importFile')
      .setInputFiles({
        name:
          'chpcc-release-candidate.json',
        mimeType:
          'application/json',
        buffer: Buffer.from(
          completed.text,
          'utf8'
        )
      });

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText(
      'Century Challenge · Calgary Flames',
      {
        timeout: 30_000
      }
    );

    await expect(
      page.locator('#challengeDashboard')
    ).toContainText('Season 1 of 100');

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const restored =
      await exportPortable(page);

    assertPortableFoundation(restored.save);

    expect(
      restored.save.current?.season
    ).toBe(initialSeason);

    expect(
      restored.save.current?.phase
    ).toBe('season-complete');

    expect(
      restored.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      restored.save.summaries
    ).toHaveLength(
      initialSummaryCount + 1
    );

    expect(
      restored.save.current
        ?.nextLeagueAssignments
    ).toBeTruthy();

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
    ).toContainText('Season 1 of 100');

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const reloaded =
      await exportPortable(page);

    assertPortableFoundation(reloaded.save);

    expect(
      reloaded.save.current?.season
    ).toBe(initialSeason);

    expect(
      reloaded.save.current?.phase
    ).toBe('season-complete');

    expect(
      reloaded.save.summaries
    ).toHaveLength(
      initialSummaryCount + 1
    );
  }
);
