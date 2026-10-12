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
  '../release-candidate/rc-helpers'
);

const TOTAL_SEASONS = 100;

const CHECKPOINTS = new Set([
  20,
  40,
  60,
  80,
  100
]);

test(
  'one hundred deterministic CHP seasons preserve durability, history and storage invariants',
  async ({
    page,
    criticalErrors
  }, testInfo) => {
    test.setTimeout(1_200_000);

    await installDeterministicRandom(
      page,
      2051100
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

    const benchmarkStartedAt =
      Date.now();

    let finalCompletedExport = null;

    for (
      let completed = 1;
      completed <= TOTAL_SEASONS;
      completed += 1
    ) {
      const season = 2025 + completed;
      const seasonStartedAt = Date.now();

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

      const seasonDurationMs =
        Date.now() - seasonStartedAt;

      if (CHECKPOINTS.has(completed)) {
        const exportStartedAt =
          Date.now();

        const checkpoint =
          await exportPortable(
            page,
            activate,
            testInfo
          );

        const exportDurationMs =
          Date.now() - exportStartedAt;

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

        expect(
          checkpoint.save.directory
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
          historyIds.size,
          'The portable save must contain exactly 932 unique history IDs.'
        ).toBe(932);

        const directoryIds = new Set(
          checkpoint.save.directory.map(
            entry =>
              Array.isArray(entry)
                ? entry[0]
                : entry?.id
          )
        );

        expect(
          directoryIds.size,
          'The portable save must contain exactly 932 unique directory IDs.'
        ).toBe(932);

        expect(
          checkpoint.save.current
            ?.nextLeagueAssignments
        ).toBeTruthy();

        console.log(
          'CHP_100_SEASON_CHECKPOINT ' +
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
                  ?.length,
              seasonDurationMs,
              exportDurationMs,
              elapsedMs:
                Date.now() -
                benchmarkStartedAt,
              exportBytes:
                Buffer.byteLength(
                  checkpoint.text,
                  'utf8'
                )
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

        const reloadExportStartedAt =
          Date.now();

        const reloadedCheckpoint =
          await exportPortable(
            page,
            activate,
            testInfo
          );

        const reloadExportDurationMs =
          Date.now() -
          reloadExportStartedAt;

        assertPortableIntegrity(
          reloadedCheckpoint.save,
          season,
          'season-complete'
        );

        assertExactCapacities(
          reloadedCheckpoint.save
        );

        expect(
          reloadedCheckpoint.save.current
            ?.post?.stage
        ).toBe('complete');

        expect(
          reloadedCheckpoint.save
            .summaries
        ).toHaveLength(completed);

        expect(
          reloadedCheckpoint.save
            .histories
        ).toHaveLength(932);

        expect(
          reloadedCheckpoint.save
            .directory
        ).toHaveLength(932);

        const reloadedHistoryIds =
          new Set();

        for (
          const [teamId, record]
          of reloadedCheckpoint.save
            .histories
        ) {
          reloadedHistoryIds.add(teamId);

          expect(
            record.history,
            `Team ${teamId} must retain ${completed} history records after reload.`
          ).toHaveLength(completed);
        }

        expect(
          reloadedHistoryIds.size,
          'The reloaded portable save must retain exactly 932 unique history IDs.'
        ).toBe(932);

        console.log(
          'CHP_100_SEASON_RELOAD ' +
            JSON.stringify({
              completedSeasons:
                completed,
              calendarSeason:
                reloadedCheckpoint.save
                  .current?.season,
              phase:
                reloadedCheckpoint.save
                  .current?.phase,
              summaryCount:
                reloadedCheckpoint.save
                  .summaries?.length,
              historyCount:
                reloadedCheckpoint.save
                  .histories?.length,
              directoryCount:
                reloadedCheckpoint.save
                  .directory?.length,
              reloadExportDurationMs,
              elapsedMs:
                Date.now() -
                benchmarkStartedAt,
              exportBytes:
                Buffer.byteLength(
                  reloadedCheckpoint.text,
                  'utf8'
                )
            })
        );

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
      'The final season-100 portable save must have been captured.'
    ).not.toBeNull();

    expect(
      finalCompletedExport.save.current
        ?.season
    ).toBe(2125);

    expect(
      finalCompletedExport.save.current
        ?.phase
    ).toBe('season-complete');

    expect(
      finalCompletedExport.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      finalCompletedExport.save.summaries
    ).toHaveLength(100);

    expect(
      finalCompletedExport.save.histories
    ).toHaveLength(932);

    expect(
      finalCompletedExport.save.directory
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of finalCompletedExport.save
        .histories
    ) {
      expect(
        record.history,
        `Final team ${teamId} must have exactly 100 history records.`
      ).toHaveLength(100);
    }

    await activate(
      page
        .locator('[data-sim="next"]')
        .first(),
      testInfo
    );

    await expect(
      page.locator('#seasonMenu')
    ).toContainText(
      '2126/',
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
      2126,
      'regular'
    );

    assertExactCapacities(
      advanced.save
    );

    expect(
      advanced.save.current
        ?.nextLeagueAssignments
    ).toBeFalsy();

    expect(
      advanced.save.summaries
    ).toHaveLength(100);

    expect(
      advanced.save.histories
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of advanced.save.histories
    ) {
      expect(
        record.history,
        `Advanced team ${teamId} must retain 100 history records.`
      ).toHaveLength(100);
    }

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

    const importStartedAt =
      Date.now();

    await page
      .locator('#importFile')
      .setInputFiles({
        name:
          'chp-hundred-season-benchmark.json',
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
      '2125/',
      {
        timeout: 60_000
      }
    );

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const importDurationMs =
      Date.now() - importStartedAt;

    const importedExportStartedAt =
      Date.now();

    const imported =
      await exportPortable(
        page,
        activate,
        testInfo
      );

    const importedExportDurationMs =
      Date.now() -
      importedExportStartedAt;

    assertPortableIntegrity(
      imported.save,
      2125,
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
    ).toHaveLength(100);

    expect(
      imported.save.histories
    ).toHaveLength(932);

    expect(
      imported.save.directory
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of imported.save.histories
    ) {
      expect(
        record.history,
        `Imported team ${teamId} must retain 100 history records.`
      ).toHaveLength(100);
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
    ).toContainText('2125/');

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const postImportReloadExportStartedAt =
      Date.now();

    const importedAfterReload =
      await exportPortable(
        page,
        activate,
        testInfo
      );

    const postImportReloadExportDurationMs =
      Date.now() -
      postImportReloadExportStartedAt;

    assertPortableIntegrity(
      importedAfterReload.save,
      2125,
      'season-complete'
    );

    assertExactCapacities(
      importedAfterReload.save
    );

    expect(
      importedAfterReload.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      importedAfterReload.save.summaries
    ).toHaveLength(100);

    expect(
      importedAfterReload.save.histories
    ).toHaveLength(932);

    expect(
      importedAfterReload.save.directory
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of importedAfterReload.save
        .histories
    ) {
      expect(
        record.history,
        `Imported team ${teamId} must retain 100 history records after reload.`
      ).toHaveLength(100);
    }

    console.log(
      'CHP_100_SEASON_COMPLETE ' +
        JSON.stringify({
          completedSeasons: 100,
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
              .directory?.length,
          finalExportBytes:
            Buffer.byteLength(
              importedAfterReload.text,
              'utf8'
            ),
          importDurationMs,
          importedExportDurationMs,
          postImportReloadExportDurationMs,
          totalDurationMs:
            Date.now() -
            benchmarkStartedAt
        })
    );
  }
);
