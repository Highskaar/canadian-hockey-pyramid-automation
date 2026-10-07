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
  'five deterministic Century Challenge seasons preserve competition, history and storage invariants',
  async ({ observed }) => {
    test.setTimeout(420_000);

    const { page } = observed;

    await installDeterministicRandom(
      page,
      52022
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

    const initialHistories =
      Array.isArray(initial.save.histories)
        ? initial.save.histories
        : [];

    expect(initialHistories).toHaveLength(932);

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

    for (
      let completed = 0;
      completed < 5;
      completed += 1
    ) {
      const expectedSeason =
        initialSeason + completed;

      const expectedChallengeSeason =
        completed + 1;

      await expect(
        page.locator('#challengeDashboard')
      ).toContainText(
        'Season ' +
          expectedChallengeSeason +
          ' of 100'
      );

      await page
        .locator('[data-sim="season"]')
        .click();

      await expect(
        page.locator('#btnExport')
      ).toBeEnabled({
        timeout: 30_000
      });

      const completedState =
        await exportPortable(page);

      assertPortableFoundation(
        completedState.save
      );

      expect(
        completedState.save.current?.season
      ).toBe(expectedSeason);

      expect(
        completedState.save.current?.phase
      ).toBe('season-complete');

      expect(
        completedState.save.current
          ?.post?.stage
      ).toBe('complete');

      expect(
        completedState.save.summaries
      ).toHaveLength(
        initialSummaryCount +
          completed +
          1
      );

      expect(
        completedState.save.histories
      ).toHaveLength(932);

      for (
        const [teamId, record]
        of completedState.save.histories
      ) {
        expect(
          initialHistoryLengths.has(teamId),
          'Every team must retain its stable history identity.'
        ).toBeTruthy();

        expect(
          record.history
        ).toHaveLength(
          initialHistoryLengths.get(teamId) +
            completed +
            1
        );
      }

      expect(
        completedState.save.current
          ?.nextLeagueAssignments
      ).toBeTruthy();

      if (completed < 4) {
        const nextButton = page
          .locator('[data-sim="next"]')
          .first();

        await expect(
          nextButton
        ).toBeEnabled();

        await nextButton.click();

        await expect(
          page.locator(
            '#challengeDashboard'
          )
        ).toContainText(
          'Season ' +
            (expectedChallengeSeason + 1) +
            ' of 100',
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
        ).toBe(expectedSeason + 1);

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
          initialSummaryCount +
            completed +
            1
        );

        expect(
          nextSeason.save.histories
        ).toHaveLength(932);

        for (
          const [teamId, record]
          of nextSeason.save.histories
        ) {
          expect(
            initialHistoryLengths.has(
              teamId
            ),
            'Every team must retain its stable history identity.'
          ).toBeTruthy();

          expect(
            record.history
          ).toHaveLength(
            initialHistoryLengths.get(
              teamId
            ) +
              completed +
              1
          );
        }
      }
    }

    const dashboardBeforeReload = await page
  .locator('#challengeDashboard')
  .innerText();

const saveBeforeReload =
  await exportPortable(page);

assertPortableFoundation(
  saveBeforeReload.save
);

console.log(
  'CHPCC_DIAGNOSTIC_BEFORE_RELOAD ' +
    JSON.stringify({
      dashboard: dashboardBeforeReload,
      calendarSeason:
        saveBeforeReload.save.current?.season,
      phase:
        saveBeforeReload.save.current?.phase,
      summaryCount:
        saveBeforeReload.save.summaries?.length,
      nextLeagueAssignments:
        Boolean(
          saveBeforeReload.save.current
            ?.nextLeagueAssignments
        ),
      currentChallengeKeys:
        Object.keys(
          saveBeforeReload.save.current || {}
        ).filter(key =>
          /challenge|century|mode/i.test(key)
        ),
      topLevelChallengeKeys:
        Object.keys(
          saveBeforeReload.save || {}
        ).filter(key =>
          /challenge|century|mode/i.test(key)
        )
    })
);

await expect(
  page
    .locator('[data-sim="next"]')
    .first()
).toBeEnabled();

await page.reload({
  waitUntil: 'domcontentloaded'
});

await page.waitForFunction(
  () =>
    window.CHP_BOOTSTRAP_READY === true
);

const dashboardAfterReload = await page
  .locator('#challengeDashboard')
  .innerText();

const saveAfterReload =
  await exportPortable(page);

assertPortableFoundation(
  saveAfterReload.save
);

console.log(
  'CHPCC_DIAGNOSTIC_AFTER_RELOAD ' +
    JSON.stringify({
      dashboard: dashboardAfterReload,
      calendarSeason:
        saveAfterReload.save.current?.season,
      phase:
        saveAfterReload.save.current?.phase,
      summaryCount:
        saveAfterReload.save.summaries?.length,
      nextLeagueAssignments:
        Boolean(
          saveAfterReload.save.current
            ?.nextLeagueAssignments
        ),
      currentChallengeKeys:
        Object.keys(
          saveAfterReload.save.current || {}
        ).filter(key =>
          /challenge|century|mode/i.test(key)
        ),
      topLevelChallengeKeys:
        Object.keys(
          saveAfterReload.save || {}
        ).filter(key =>
          /challenge|century|mode/i.test(key)
        )
    })
);

await expect(
  page.locator('#challengeDashboard')
).toContainText(
  'Century Challenge · Calgary Flames'
);


    await expect(
  page.locator('#challengeDashboard')
).toContainText('Season 6 of 100');

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
    ).toBe(initialSeason + 4);

    expect(
      reloaded.save.current?.phase
    ).toBe('season-complete');

    expect(
      reloaded.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      reloaded.save.summaries
    ).toHaveLength(
      initialSummaryCount + 5
    );

    expect(
      reloaded.save.histories
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of reloaded.save.histories
    ) {
      expect(
        initialHistoryLengths.has(teamId),
        'Every team must retain its stable history identity after reload.'
      ).toBeTruthy();

      expect(
        record.history
      ).toHaveLength(
        initialHistoryLengths.get(teamId) +
          5
      );
    }
  }
);
