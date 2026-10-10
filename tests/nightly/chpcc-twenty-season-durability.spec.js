const {
  test,
  expect,
  installDeterministicRandom,
  installExportCapture,
  openReadyApp,
  createCenturyChallenge,
  exportPortable,
  assertPortableFoundation
} = require(
  '../chpcc-release-candidate/chpcc-rc-helpers'
);

const TOTAL_SEASONS = 20;

const CHECKPOINTS = new Set([
  5,
  10,
  15,
  20
]);

test(
  'twenty deterministic Century Challenge seasons preserve durability, history and storage invariants',
  async ({ observed }) => {
    test.setTimeout(1_200_000);

    const { page } = observed;

    await installDeterministicRandom(
      page,
      2052022
    );

    await installExportCapture(page);
    await openReadyApp(page);
    await createCenturyChallenge(page);

    const initial =
      await exportPortable(page);

    assertPortableFoundation(
      initial.save
    );

    const initialSeason =
      initial.save.current?.season;

    expect(
      Number.isInteger(initialSeason),
      'The initial save must contain a numeric current season.'
    ).toBeTruthy();

    expect(initialSeason).toBe(2026);

    expect(
      initial.save.current?.phase
    ).toBe('regular');

    const initialSummaryCount =
      Array.isArray(initial.save.summaries)
        ? initial.save.summaries.length
        : 0;

    const initialHistories =
      Array.isArray(initial.save.histories)
        ? initial.save.histories
        : [];

    expect(initialHistories).toHaveLength(
      932
    );

    const initialHistoryLengths =
      new Map(
        initialHistories.map(
          ([teamId, record]) => [
            teamId,
            Array.isArray(record?.history)
              ? record.history.length
              : 0
          ]
        )
      );

    expect(
      initialHistoryLengths.size
    ).toBe(932);

    const initialChallenge =
      initial.save.current?.challenge;

    expect(initialChallenge).toBeTruthy();

    expect(
      initialChallenge.rewardedSeasons
    ).toHaveLength(0);

    expect(
      initialChallenge.seasons
    ).toHaveLength(0);

    expect(
      initialChallenge.capital
    ).toBe(25);

    expect(
      initialChallenge.totalEarned
    ).toBe(25);

    let finalCompletedExport = null;

    for (
      let completed = 1;
      completed <= TOTAL_SEASONS;
      completed += 1
    ) {
      const calendarSeason =
        initialSeason + completed - 1;

      const expectedDashboardSeason =
        completed + 1;

      await expect(
        page.locator(
          '#challengeDashboard'
        )
      ).toContainText(
        `Season ${completed} of 100`
      );

      await page
        .locator('[data-sim="season"]')
        .click();

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

      await expect(
        page.locator(
          '#challengeDashboard'
        )
      ).toContainText(
        `Season ${expectedDashboardSeason} of 100`,
        {
          timeout: 60_000
        }
      );

      if (CHECKPOINTS.has(completed)) {
        const checkpoint =
          await exportPortable(page);

        assertPortableFoundation(
          checkpoint.save
        );

        expect(
          checkpoint.save.current?.season
        ).toBe(calendarSeason);

        expect(
          checkpoint.save.current?.phase
        ).toBe('season-complete');

        expect(
          checkpoint.save.current
            ?.post?.stage
        ).toBe('complete');

        expect(
          checkpoint.save.summaries
        ).toHaveLength(
          initialSummaryCount + completed
        );

        expect(
          checkpoint.save.histories
        ).toHaveLength(932);

        const checkpointHistoryIds =
          new Set();

        for (
          const [teamId, record]
          of checkpoint.save.histories
        ) {
          checkpointHistoryIds.add(
            teamId
          );

          expect(
            initialHistoryLengths.has(
              teamId
            ),
            `Team ${teamId} must retain its stable history identity.`
          ).toBeTruthy();

          expect(
            record.history,
            `Team ${teamId} must have exactly ${completed} additional history records.`
          ).toHaveLength(
            initialHistoryLengths.get(
              teamId
            ) + completed
          );
        }

        expect(
          checkpointHistoryIds.size
        ).toBe(932);

        expect(
          checkpoint.save.current
            ?.nextLeagueAssignments
        ).toBeTruthy();

        const challenge =
          checkpoint.save.current
            ?.challenge;

        expect(challenge).toBeTruthy();

        expect(
          challenge.rewardedSeasons
        ).toHaveLength(completed);

        expect(
          new Set(
            challenge.rewardedSeasons
          ).size
        ).toBe(completed);

        expect(
          challenge.seasons
        ).toHaveLength(completed);

        expect(
          challenge.seasons.every(
            season =>
              Number.isFinite(
                season.income
              )
          )
        ).toBeTruthy();

        const recordedIncome =
          challenge.seasons.reduce(
            (
              total,
              season
            ) =>
              total +
              season.income,
            0
          );

        expect(
          challenge.totalEarned
        ).toBe(
          25 + recordedIncome
        );

        expect(
          challenge.capital
        ).toBe(
          challenge.totalEarned
        );

        expect(
          challenge.lastReward
        ).toBe(
          challenge.seasons.at(-1)
            ?.income
        );

        const chcTitles =
          challenge.seasons.filter(
            season => season.chc
          ).length;

        const cupTitles =
          challenge.seasons.filter(
            season => season.cup
          ).length;

        expect(
          challenge.majorTitles?.chc
        ).toBe(chcTitles);

        expect(
          challenge.majorTitles?.cup
        ).toBe(cupTitles);

        console.log(
          'CHPCC_NIGHTLY_CHECKPOINT ' +
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
              rewardedSeasonCount:
                challenge.rewardedSeasons
                  ?.length,
              challengeSeasonCount:
                challenge.seasons
                  ?.length,
              capital:
                challenge.capital,
              totalEarned:
                challenge.totalEarned,
              lastReward:
                challenge.lastReward,
              majorTitles:
                challenge.majorTitles
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
          page.locator(
            '#challengeDashboard'
          )
        ).toContainText(
          `Season ${expectedDashboardSeason} of 100`
        );

        await expect(
          page
            .locator('[data-sim="next"]')
            .first()
        ).toBeEnabled();

        const reloadedCheckpoint =
          await exportPortable(page);

        assertPortableFoundation(
          reloadedCheckpoint.save
        );

        expect(
          reloadedCheckpoint.save.current
            ?.season
        ).toBe(calendarSeason);

        expect(
          reloadedCheckpoint.save.current
            ?.phase
        ).toBe('season-complete');

        expect(
          reloadedCheckpoint.save
            .summaries
        ).toHaveLength(
          initialSummaryCount + completed
        );

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
            `Team ${teamId} must retain its history after reload.`
          ).toHaveLength(
            initialHistoryLengths.get(
              teamId
            ) + completed
          );
        }

        const reloadedChallenge =
          reloadedCheckpoint.save.current
            ?.challenge;

        expect(
          reloadedChallenge
        ).toEqual(challenge);

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
        await page
          .locator('[data-sim="next"]')
          .first()
          .click();

        await expect(
          page.locator(
            '#challengeDashboard'
          )
        ).toContainText(
          `Season ${completed + 1} of 100`,
          {
            timeout: 60_000
          }
        );
      }
    }

    expect(
      finalCompletedExport,
      'The final season-20 Century Challenge save must have been captured.'
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
    ).toHaveLength(
      initialSummaryCount + 20
    );

    expect(
      finalCompletedExport.save.histories
    ).toHaveLength(932);

    const finalChallenge =
      finalCompletedExport.save.current
        ?.challenge;

    expect(finalChallenge).toBeTruthy();

    expect(
      finalChallenge.rewardedSeasons
    ).toHaveLength(20);

    expect(
      new Set(
        finalChallenge.rewardedSeasons
      ).size
    ).toBe(20);

    expect(
      finalChallenge.seasons
    ).toHaveLength(20);

    await page
      .locator('[data-sim="next"]')
      .first()
      .click();

    await expect(
      page.locator(
        '#challengeDashboard'
      )
    ).toContainText(
      'Season 21 of 100',
      {
        timeout: 60_000
      }
    );

    const advanced =
      await exportPortable(page);

    assertPortableFoundation(
      advanced.save
    );

    expect(
      advanced.save.current?.season
    ).toBe(2046);

    expect(
      advanced.save.current?.phase
    ).toBe('regular');

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
          'chpcc-nightly-season-20.json',
        mimeType:
          'application/json',
        buffer: Buffer.from(
          finalCompletedExport.text,
          'utf8'
        )
      });

    await expect(
      page.locator(
        '#challengeDashboard'
      )
    ).toContainText(
      'Century Challenge · Calgary Flames',
      {
        timeout: 60_000
      }
    );

    await expect(
      page.locator(
        '#challengeDashboard'
      )
    ).toContainText(
      'Season 21 of 100'
    );

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const imported =
      await exportPortable(page);

    assertPortableFoundation(
      imported.save
    );

    expect(
      imported.save.current?.season
    ).toBe(2045);

    expect(
      imported.save.current?.phase
    ).toBe('season-complete');

    expect(
      imported.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      imported.save.summaries
    ).toHaveLength(
      initialSummaryCount + 20
    );

    expect(
      imported.save.histories
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of imported.save.histories
    ) {
      expect(
        record.history,
        `Imported team ${teamId} must retain its final history.`
      ).toHaveLength(
        initialHistoryLengths.get(
          teamId
        ) + 20
      );
    }

    expect(
      imported.save.current
        ?.challenge
    ).toEqual(finalChallenge);

    await page.reload({
      waitUntil: 'domcontentloaded'
    });

    await page.waitForFunction(
      () =>
        window.CHP_BOOTSTRAP_READY === true
    );

    await expect(
      page.locator(
        '#challengeDashboard'
      )
    ).toContainText(
      'Century Challenge · Calgary Flames'
    );

    await expect(
      page.locator(
        '#challengeDashboard'
      )
    ).toContainText(
      'Season 21 of 100'
    );

    await expect(
      page
        .locator('[data-sim="next"]')
        .first()
    ).toBeEnabled();

    const importedAfterReload =
      await exportPortable(page);

    assertPortableFoundation(
      importedAfterReload.save
    );

    expect(
      importedAfterReload.save.current
        ?.season
    ).toBe(2045);

    expect(
      importedAfterReload.save.current
        ?.phase
    ).toBe('season-complete');

    expect(
      importedAfterReload.save.summaries
    ).toHaveLength(
      initialSummaryCount + 20
    );

    expect(
      importedAfterReload.save.histories
    ).toHaveLength(932);

    expect(
      importedAfterReload.save.current
        ?.challenge
    ).toEqual(finalChallenge);

    console.log(
      'CHPCC_NIGHTLY_COMPLETE ' +
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
              .directory?.length,
          rewardedSeasonCount:
            importedAfterReload.save
              .current?.challenge
              ?.rewardedSeasons?.length,
          challengeSeasonCount:
            importedAfterReload.save
              .current?.challenge
              ?.seasons?.length,
          capital:
            importedAfterReload.save
              .current?.challenge
              ?.capital,
          totalEarned:
            importedAfterReload.save
              .current?.challenge
              ?.totalEarned
        })
    );
  }
);
