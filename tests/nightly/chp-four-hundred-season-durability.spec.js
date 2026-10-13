const { test, expect, openApp, activate } = require('../fixtures/chp-test');
const {
  installDeterministicRandom,
  installExportCapture,
  exportPortable,
  assertPortableIntegrity,
  assertExactCapacities
} = require('../release-candidate/rc-helpers');

const TOTAL_SEASONS = 400;
const CHECKPOINTS = new Set([ 100, 200, 300, 400 ]);

async function dismissCenturyMilestone(page, testInfo) {
  const overlay = page.locator('#p4Overlay');

  await expect(overlay).toBeVisible({ timeout: 60_000 });
  await expect(
    overlay.getByRole('heading', {
      name: 'That’s it! 100 years of Canadian Pyramid hockey!'
    })
  ).toBeVisible();

  await activate(
    overlay.getByRole('button', { name: 'Keep going', exact: true }),
    testInfo
  );

  await expect(overlay).toHaveClass(/hidden/);
}

test(
  'four hundred deterministic CHP seasons preserve durability, history and storage invariants',
  async ({ page, criticalErrors }, testInfo) => {
    test.setTimeout(2_700_000);

    await installDeterministicRandom(page, 2051400);
    await installExportCapture(page);
    await openApp(page);

    await expect(page.locator('header')).toContainText(
      `v${process.env.TEST_EXPECTED_VERSION}`
    );
    await expect(page.locator('#seasonMenu')).toContainText('2026/27');

    const benchmarkStartedAt = Date.now();
    let finalCompletedExport = null;

    for (let completed = 1; completed <= TOTAL_SEASONS; completed += 1) {
      const season = 2025 + completed;
      const seasonStartedAt = Date.now();

      await activate(page.locator('[data-sim="season"]'), testInfo);

      if (completed === 100) {
        await dismissCenturyMilestone(page, testInfo);
      }

      await expect(page.locator('#btnExport')).toBeEnabled({ timeout: 60_000 });
      await expect(
        page.locator('[data-sim="next"]').first()
      ).toBeEnabled({ timeout: 60_000 });

      const seasonDurationMs = Date.now() - seasonStartedAt;

      if (CHECKPOINTS.has(completed)) {
        const exportStartedAt = Date.now();
        const checkpoint = await exportPortable(page, activate, testInfo);
        const exportDurationMs = Date.now() - exportStartedAt;

        assertPortableIntegrity(checkpoint.save, season, 'season-complete');
        assertExactCapacities(checkpoint.save);

        expect(checkpoint.save.current?.post?.stage).toBe('complete');
        expect(checkpoint.save.summaries).toHaveLength(completed);
        expect(checkpoint.save.histories).toHaveLength(932);

        const historyIds = new Set();
        for (const [teamId, record] of checkpoint.save.histories) {
          historyIds.add(teamId);
          expect(
            record.history,
            `Team ${teamId} must have exactly ${completed} history records.`
          ).toHaveLength(completed);
        }

        expect(historyIds.size).toBe(932);
        expect(checkpoint.save.current?.nextLeagueAssignments).toBeTruthy();

        console.log(
          'CHP_400_CHECKPOINT ' +
          JSON.stringify({
            completedSeasons: completed,
            calendarSeason: checkpoint.save.current?.season,
            phase: checkpoint.save.current?.phase,
            summaryCount: checkpoint.save.summaries.length,
            historyCount: checkpoint.save.histories.length,
            directoryCount: checkpoint.save.directory?.length,
            seasonDurationMs,
            exportDurationMs,
            exportBytes: Buffer.byteLength(checkpoint.text, 'utf8'),
            elapsedMs: Date.now() - benchmarkStartedAt
          })
        );

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);

        await expect(page.locator('header')).toContainText(
          `v${process.env.TEST_EXPECTED_VERSION}`
        );
        await expect(page.locator('#seasonMenu')).toContainText(`${season}/`);
        await expect(
          page.locator('[data-sim="next"]').first()
        ).toBeEnabled({ timeout: 60_000 });

        const postReload = await exportPortable(page, activate, testInfo);
        assertPortableIntegrity(postReload.save, season, 'season-complete');
        assertExactCapacities(postReload.save);
        expect(postReload.save.summaries).toHaveLength(completed);
        expect(postReload.save.histories).toHaveLength(932);

        for (const [teamId, record] of postReload.save.histories) {
          expect(
            record.history,
            `Team ${teamId} must retain ${completed} history records after reload.`
          ).toHaveLength(completed);
        }

        if (completed === TOTAL_SEASONS) {
          finalCompletedExport = postReload;
        }
      }

      if (completed < TOTAL_SEASONS) {
        await activate(
          page.locator('[data-sim="next"]').first(),
          testInfo
        );
        await expect(page.locator('#seasonMenu')).toContainText(
          `${season + 1}/`,
          { timeout: 60_000 }
        );
      }
    }

    expect(finalCompletedExport).toBeTruthy();

    const importDialogs = [];
    page.on('dialog', async dialog => {
      importDialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.locator('#importFile').setInputFiles({
      name: 'chp-400-season-roundtrip.json',
      mimeType: 'application/json',
      buffer: Buffer.from(finalCompletedExport.text, 'utf8')
    });

    await expect.poll(
      () => importDialogs.length,
      { timeout: 120_000 }
    ).toBeGreaterThan(0);

    expect(
      importDialogs.some(message =>
        message.includes('Save loaded successfully')
      )
    ).toBeTruthy();

    await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
    await expect(page.locator('#seasonMenu')).toContainText('2425/', {
      timeout: 120_000
    });
    await expect(
      page.locator('[data-sim="next"]').first()
    ).toBeEnabled({ timeout: 60_000 });

    const imported = await exportPortable(page, activate, testInfo);
    assertPortableIntegrity(imported.save, 2425, 'season-complete');
    assertExactCapacities(imported.save);
    expect(imported.save.summaries).toHaveLength(TOTAL_SEASONS);
    expect(imported.save.histories).toHaveLength(932);

    for (const [teamId, record] of imported.save.histories) {
      expect(
        record.history,
        `Imported team ${teamId} must retain ${TOTAL_SEASONS} history records.`
      ).toHaveLength(TOTAL_SEASONS);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CHP_BOOTSTRAP_READY === true);
    await expect(page.locator('#seasonMenu')).toContainText('2425/');
    await expect(
      page.locator('[data-sim="next"]').first()
    ).toBeEnabled({ timeout: 60_000 });

    const postImportReload = await exportPortable(page, activate, testInfo);
    assertPortableIntegrity(postImportReload.save, 2425, 'season-complete');
    assertExactCapacities(postImportReload.save);
    expect(postImportReload.save.summaries).toHaveLength(TOTAL_SEASONS);
    expect(postImportReload.save.histories).toHaveLength(932);

    for (const [teamId, record] of postImportReload.save.histories) {
      expect(
        record.history,
        `Imported team ${teamId} must retain ${TOTAL_SEASONS} history records after reload.`
      ).toHaveLength(TOTAL_SEASONS);
    }

    console.log(
      'CHP_400_COMPLETE ' +
      JSON.stringify({
        completedSeasons: TOTAL_SEASONS,
        calendarSeason: postImportReload.save.current?.season,
        phase: postImportReload.save.current?.phase,
        summaryCount: postImportReload.save.summaries.length,
        historyCount: postImportReload.save.histories.length,
        directoryCount: postImportReload.save.directory?.length,
        exportBytes: Buffer.byteLength(postImportReload.text, 'utf8'),
        totalDurationMs: Date.now() - benchmarkStartedAt
      })
    );

    expect(criticalErrors).toEqual([]);
  }
);
