const {
  test,
  expect,
  openApp,
  activate
} = require('../fixtures/chp-test');

const {
  installDeterministicRandom,
  installExportCapture,
  exportPortable,
  assertPortableIntegrity,
  assertExactCapacities
} = require(
  '../chp-release-candidate/rc-helpers'
);

const TOTAL_SEASONS = 20;

const CHECKPOINTS = new Set([
  5,
  10,
  15,
  20
]);

test(
  'twenty deterministic CHP seasons preserve durability, history and storage invariants',
  async ({
    page,
    criticalErrors
  }, testInfo) => {
    test.setTimeout(1_200_000);

    await installDeterministicRandom(
      page,
      205108
    );

    await installExportCapture(page);
    await openApp(page);

    await expect(
      page.locator('header')
    ).toContainText(
      `v${process.env.TEST_EXPECTED_VERSION}`
    );

    await expect(
      page.locator('#seasonMenu')
    ).toContainText('2026/27');

    let finalCompletedExport = null;

    for (
      let completed = 1;
      completed <= TOTAL_SEASONS;
      completed += 1
    ) {
      const season = 2025 + completed;

      await activate(
        page.locator('[data-sim="season"]'),
        testInfo
      );

      await expect(
        page.locator('#btnExport')
      ).toBeEnabled({
        timeout: 60_000
      });

      await expect(
        page
          .locator('[data-sim="next"]')
          .first()
      ).toBeEnabled({
        timeout: 60_000
      });

      if (CHECKPOINTS.has(completed)) {
        const checkpoint =
          await exportPortable(
            page,
            activate,
            testInfo
          );

        assertPortableIntegrity(
          checkpoint.save,
          season,
          'season-complete'
        );

        assertExactCapacities(
          checkpoint.save
        );

        expect(
          checkpoint.save.current
            ?.post?.stage
        ).toBe('complete');

        expect(
          checkpoint.save.summaries
        ).toHaveLength(completed);

        expect(
          checkpoint.save.histories
        ).toHaveLength(932);

        const historyIds = new Set();

        for (
          const [teamId, record]
          of checkpoint.save.histories
        ) {
          historyIds.add(teamId);

          expect(
            record.history,
            `Team ${teamId} must have exactly ${completed} history records.`
          ).toHaveLength(completed);
        }

        expect(
          historyIds.size
        ).toBe(932);

        expect(
          checkpoint.save.current
            ?.nextLeagueAssignments
        ).toBeTruthy();

        console.log(
          'CHP_NIGHTLY_CHECKPOINT ' +
            JSON.stringify({
              completedSeasons:
                completed,
              calendarSeason:
                checkpoint.save.current
                  ?.season,
              phase:
                checkpoint.save.current
                  ?.phase,
              summaryCount:
                checkpoint.save.summaries
                  ?.length,
              historyCount:
                checkpoint.save.histories
                  ?.length,
              directoryCount:
                checkpoint.save.directory
                  ?.length
            })
        );

        await page.reload({
          waitUntil:
            'domcontentloaded'
        });

        await page.waitForFunction(
          () =>
            window.CHP_BOOTSTRAP_READY ===
            true
        );

        await expect(
          page.locator('#seasonMenu')
        ).toContainText(
          `${season}/`
        );

        await expect(
          page
            .locator('[data-sim="next"]')
            .first()
        ).toBeEnabled();

        const reloadedCheckpoint =
          await exportPortable(
            page,
            activate,
            testInfo
          );

        assertPortableIntegrity(
          reloadedCheckpoint.save,
          season,
          'season-complete'
        );

        assertExactCapacities(
          reloadedCheckpoint.save
        );

        expect(
          reloadedCheckpoint.save
            .summaries
        ).toHaveLength(completed);

        expect(
          reloadedCheckpoint.save
            .histories
        ).toHaveLength(932);

        for (
          const [teamId, record]
          of reloadedCheckpoint.save
            .histories
        ) {
          expect(
            record.history,
            `Team ${teamId} must retain ${completed} history records after reload.`
          ).toHaveLength(completed);
        }

        if (
          completed ===
          TOTAL_SEASONS
        ) {
          finalCompletedExport =
            reloadedCheckpoint;
        }
      }

      if (
        completed <
        TOTAL_SEASONS
      ) {
        await activate(
          page
            .locator('[data-sim="next"]')
            .first(),
          testInfo
        );

        await expect(
          page.locator('#seasonMenu')
        ).toContainText(
          `${season + 1}/`,
          {
            timeout: 60_000
          }
        );
      }
    }

    expect(
      finalCompletedExport,
      'The final season-20 portable save must have been captured.'
    ).not.toBeNull();

    expect(
      finalCompletedExport.save.current
        ?.season
    ).toBe(2045);

    expect(
      finalCompletedExport.save.current
        ?.phase
    ).toBe('season-complete');

    expect(
      finalCompletedExport.save.summaries
    ).toHaveLength(20);

    expect(
      finalCompletedExport.save.histories
    ).toHaveLength(932);

    await activate(
      page
        .locator('[data-sim="next"]')
        .first(),
      testInfo
    );

    await expect(
      page.locator('#seasonMenu')
    ).toContainText(
      '2046/',
      {
        timeout: 60_000
      }
    );

    const advanced =
      await exportPortable(
        page,
        activate,
        testInfo
      );

    assertPortableIntegrity(
      advanced.save,
      2046,
      'regular'
    );

    expect(
      advanced.save.current
        ?.nextLeagueAssignments
    ).toBeFalsy();

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
          'chp-nightly-season-20.json',
        mimeType:
          'application/json',
        buffer: Buffer.from(
          finalCompletedExport.text,
          'utf8'
        )
      });

    await expect(
      page.locator('#seasonMenu')
    ).toContainText(
      '2045/',
      {
        timeout: 60_000
      }
    );

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const imported =
      await exportPortable(
        page,
        activate,
        testInfo
      );

    assertPortableIntegrity(
      imported.save,
      2045,
      'season-complete'
    );

    assertExactCapacities(
      imported.save
    );

    expect(
      imported.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      imported.save.summaries
    ).toHaveLength(20);

    expect(
      imported.save.histories
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of imported.save.histories
    ) {
      expect(
        record.history,
        `Imported team ${teamId} must retain 20 history records.`
      ).toHaveLength(20);
    }

    await page.reload({
      waitUntil: 'domcontentloaded'
    });

    await page.waitForFunction(
      () =>
        window.CHP_BOOTSTRAP_READY === true
    );

    await expect(
      page.locator('#seasonMenu')
    ).toContainText('2045/');

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const importedAfterReload =
      await exportPortable(
        page,
        activate,
        testInfo
      );

    assertPortableIntegrity(
      importedAfterReload.save,
      2045,
      'season-complete'
    );

    assertExactCapacities(
      importedAfterReload.save
    );

    expect(
      importedAfterReload.save.summaries
    ).toHaveLength(20);

    expect(
      importedAfterReload.save.histories
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of importedAfterReload.save
        .histories
    ) {
      expect(
        record.history,
        `Imported team ${teamId} must retain 20 history records after reload.`
      ).toHaveLength(20);
    }

    console.log(
      'CHP_NIGHTLY_COMPLETE ' +
        JSON.stringify({
          completedSeasons: 20,
          calendarSeason:
            importedAfterReload.save
              .current?.season,
          phase:
            importedAfterReload.save
              .current?.phase,
          summaryCount:
            importedAfterReload.save
              .summaries?.length,
          historyCount:
            importedAfterReload.save
              .histories?.length,
          directoryCount:
            importedAfterReload.save
              .directory?.length
        })
    );
  }
);
