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

const TOTAL_SEASONS = 400;
const CHALLENGE_SEASONS = 100;

const CHECKPOINTS = new Set([
  100,
  200,
  300,
  400
]);

async function dismissCenturyMilestoneIfVisible(
  page
) {
  const overlay = page.locator('#p4Overlay');

  const appeared = await overlay
    .waitFor({
      state: 'visible',
      timeout: 10_000
    })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    return;
  }

  const overlayText = await overlay
    .innerText()
    .catch(() => '');

  const visibleButtons = overlay
    .locator('button:visible');

  const buttonLabels = await visibleButtons
    .allTextContents();

  console.log(
    'CHPCC_400_OVERLAY ' +
      JSON.stringify({
        text: overlayText,
        buttons: buttonLabels
      })
  );

  expect(
    buttonLabels.length,
    'The visible season-100 overlay must provide a button that can dismiss it.'
  ).toBeGreaterThan(0);

  const preferredButton = overlay.getByRole(
    'button',
    {
      name: /keep going|continue|close|dismiss|free play/i
    }
  ).first();

  const dismissButton = await preferredButton
    .isVisible()
    .catch(() => false)
    ? preferredButton
    : visibleButtons.last();

  await dismissButton.click();

  await expect(
    overlay
  ).toBeHidden({
    timeout: 30_000
  });
}
function assertChallengeIntegrity(
  challenge,
  completed
) {
  expect(
    challenge,
    'The portable save must contain Century Challenge state.'
  ).toBeTruthy();

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
      (total, season) =>
        total + season.income,
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

  if (
    completed ===
    CHALLENGE_SEASONS
  ) {
    expect(
      challenge.complete
    ).toBeTruthy();

    expect(
      challenge.result
    ).toEqual({
      chc: challenge.majorTitles.chc,
      cup: challenge.majorTitles.cup
    });
  }
}

test(
  'four hundred deterministic CHPCC seasons preserve durability, history and storage invariants',
  async ({ observed }) => {
    test.setTimeout(2_700_000);

    const { page } = observed;

    await installDeterministicRandom(
      page,
      2052400
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
      initialSeason
    ).toBe(2026);

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

    expect(
      initialHistories
    ).toHaveLength(932);

    const initialHistoryLengths =
      new Map(
        initialHistories.map(
          ([teamId, record]) => [
            teamId,
            Array.isArray(
              record?.history
            )
              ? record.history.length
              : 0
          ]
        )
      );

    expect(
      initialHistoryLengths.size
    ).toBe(932);

    const initialChallenge =
      initial.save.current
        ?.challenge;

    expect(
      initialChallenge
    ).toBeTruthy();

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

    const benchmarkStartedAt =
      Date.now();

    let finalCompletedExport = null;
    let finalChallenge = null;
    let completedChallengeSnapshot = null;

    for (
      let completed = 1;
      completed <= TOTAL_SEASONS;
      completed += 1
    ) {
      const calendarSeason =
        initialSeason +
        completed -
        1;

      const expectedBeforeSimulation =
        Math.min(
          CHALLENGE_SEASONS,
          completed
        );

      const expectedAfterSimulation =
        Math.min(
          CHALLENGE_SEASONS,
          completed + 1
        );

      await expect(
        page.locator(
          '#challengeDashboard'
        )
      ).toContainText(
        `Season ${expectedBeforeSimulation} of 100`
      );

      const seasonStartedAt =
        Date.now();

      await page
        .locator('[data-sim="season"]')
        .click();

      if (
        completed ===
        CHALLENGE_SEASONS
      ) {
        await dismissCenturyMilestoneIfVisible(
          page
        );
      }

      await expect(
        page.locator('#btnExport')
      ).toBeEnabled({
        timeout: 60_000
      });

      await expect(
        page.locator(
          '#challengeDashboard'
        )
      ).toContainText(
        `Season ${expectedAfterSimulation} of 100`,
        {
          timeout: 60_000
        }
      );

      const seasonDurationMs =
        Date.now() -
        seasonStartedAt;

      if (
        CHECKPOINTS.has(
          completed
        )
      ) {
        const exportStartedAt =
          Date.now();

        const checkpoint =
          await exportPortable(page);

        const exportDurationMs =
          Date.now() -
          exportStartedAt;

        assertPortableFoundation(
          checkpoint.save
        );

        expect(
          checkpoint.save.current
            ?.season
        ).toBe(calendarSeason);

        expect(
          checkpoint.save.current
            ?.phase
        ).toBe(
          'season-complete'
        );

        expect(
          checkpoint.save.current
            ?.post?.stage
        ).toBe('complete');

        expect(
          checkpoint.save.summaries
        ).toHaveLength(
          initialSummaryCount +
          completed
        );

        expect(
          checkpoint.save.histories
        ).toHaveLength(932);

        const historyIds =
          new Set();

        for (
          const [teamId, record]
          of checkpoint.save.histories
        ) {
          historyIds.add(teamId);

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
          historyIds.size
        ).toBe(932);

        expect(
          checkpoint.save.current
            ?.nextLeagueAssignments
        ).toBeTruthy();

        const challenge =
          checkpoint.save.current
            ?.challenge;

        const expectedChallengeSeasons =
          Math.min(
            completed,
            CHALLENGE_SEASONS
          );

        assertChallengeIntegrity(
          challenge,
          expectedChallengeSeasons
        );

        if (completed === CHALLENGE_SEASONS) {
          completedChallengeSnapshot =
            structuredClone(challenge);
        } else if (completed > CHALLENGE_SEASONS) {
          expect(
            completedChallengeSnapshot,
            'The completed 100-season Challenge snapshot must exist.'
          ).toBeTruthy();

          expect(
            challenge,
            'Century Challenge state must remain frozen after season 100.'
          ).toEqual(completedChallengeSnapshot);
        }

        console.log(
          'CHPCC_400_CHECKPOINT ' +
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
                  .length,
              historyCount:
                checkpoint.save.histories
                  .length,
              directoryCount:
                checkpoint.save.directory
                  ?.length,
              rewardedSeasonCount:
                challenge
                  .rewardedSeasons
                  .length,
              challengeSeasonCount:
                challenge
                  .seasons
                  .length,
              capital:
                challenge.capital,
              totalEarned:
                challenge.totalEarned,
              majorTitles:
                challenge.majorTitles,
              complete:
                challenge.complete,
              seasonDurationMs,
              exportDurationMs,
              exportBytes:
                Buffer.byteLength(
                  checkpoint.text,
                  'utf8'
                ),
              elapsedMs:
                Date.now() -
                benchmarkStartedAt
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
          page.locator('body')
        ).toContainText(
          `v${process.env.TEST_EXPECTED_VERSION}`
        );

        await expect(
          page.locator(
            '#challengeDashboard'
          )
        ).toContainText(
          `Season ${expectedAfterSimulation} of 100`
        );

        const calgaryAfterReload =
          await page.evaluate(() => {
            const team =
              allTeams(state).find(
                candidate =>
                  candidate.id ===
                  'calgary_flames'
              );

            return {
              season:
                state?.season,
              phase:
                state?.phase,
              liveHistoryLength:
                Array.isArray(
                  team?.history
                )
                  ? team.history.length
                  : null,
              historyLazy:
                Boolean(
                  team?._historyLazy
                )
            };
          });

        const postReload =
          await exportPortable(page);

        assertPortableFoundation(
          postReload.save
        );

        expect(
          postReload.save.current
            ?.season
        ).toBe(calendarSeason);

        expect(
          postReload.save.current
            ?.phase
        ).toBe(
          'season-complete'
        );

        expect(
          postReload.save.summaries
        ).toHaveLength(
          initialSummaryCount +
          completed
        );

        expect(
          postReload.save.histories
        ).toHaveLength(932);

        for (
          const [teamId, record]
          of postReload.save
            .histories
        ) {
          expect(
            record.history,
            `Team ${teamId} must retain its history through checkpoint reload.`
          ).toHaveLength(
            initialHistoryLengths.get(
              teamId
            ) + completed
          );
        }

        const reloadedChallenge =
          postReload.save.current
            ?.challenge;

        assertChallengeIntegrity(
          reloadedChallenge,
          expectedChallengeSeasons
        );

        expect(
          reloadedChallenge
        ).toEqual(challenge);

        console.log(
          'CHPCC_400_RELOAD ' +
            JSON.stringify({
              completedSeasons:
                completed,
              calendarSeason:
                postReload.save.current
                  ?.season,
              liveCalgary:
                calgaryAfterReload,
              exportedCalgaryHistoryLength:
                postReload.save.histories
                  .find(
                    ([teamId]) =>
                      teamId ===
                      'calgary_flames'
                  )?.[1]
                  ?.history
                  ?.length
            })
        );

        if (
          completed ===
          TOTAL_SEASONS
        ) {
          finalCompletedExport =
            postReload;

          finalChallenge =
            reloadedChallenge;
        }
      }

      if (
        completed <
        TOTAL_SEASONS
      ) {
        await page
          .locator(
            '[data-sim="next"]'
          )
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
      'The final 400-season CHPCC export must have been captured.'
    ).toBeTruthy();

    expect(
      finalChallenge
    ).toBeTruthy();

    expect(
      finalCompletedExport.save.current
        ?.season
    ).toBe(2425);

    expect(
      finalCompletedExport.save.current
        ?.phase
    ).toBe(
      'season-complete'
    );

    expect(
      finalCompletedExport.save
        .summaries
    ).toHaveLength(
      initialSummaryCount +
      TOTAL_SEASONS
    );

    expect(
      finalCompletedExport.save
        .histories
    ).toHaveLength(932);

    assertChallengeIntegrity(
      finalChallenge,
      CHALLENGE_SEASONS
    );

    const importDialogs = [];

    page.on(
      'dialog',
      async dialog => {
        importDialogs.push(
          dialog.message()
        );

        await dialog.accept();
      }
    );

    await page
      .locator('#importFile')
      .setInputFiles({
        name:
          'chpcc-400-season-roundtrip.json',
        mimeType:
          'application/json',
        buffer: Buffer.from(
          finalCompletedExport.text,
          'utf8'
        )
      });

    await expect.poll(
      () => importDialogs.length,
      {
        timeout: 120_000
      }
    ).toBeGreaterThan(0);

    expect(
      importDialogs.some(
        message =>
          message.includes(
            'Save loaded successfully'
          )
      )
    ).toBeTruthy();

    await page.waitForFunction(
      () =>
        window.CHP_BOOTSTRAP_READY === true
    );

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
      'Season 100 of 100'
    );

    const imported =
      await exportPortable(page);

    assertPortableFoundation(
      imported.save
    );

    expect(
      imported.save.current
        ?.season
    ).toBe(2425);

    expect(
      imported.save.current
        ?.phase
    ).toBe(
      'season-complete'
    );

    expect(
      imported.save.current
        ?.post?.stage
    ).toBe('complete');

    expect(
      imported.save.summaries
    ).toHaveLength(
      initialSummaryCount +
      TOTAL_SEASONS
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
        `Imported team ${teamId} must retain ${TOTAL_SEASONS} completed histories.`
      ).toHaveLength(
        initialHistoryLengths.get(
          teamId
        ) + TOTAL_SEASONS
      );
    }

    assertChallengeIntegrity(
      imported.save.current
        ?.challenge,
      CHALLENGE_SEASONS
    );

    expect(
      imported.save.current
        ?.challenge
    ).toEqual(finalChallenge);

    await page.reload({
      waitUntil:
        'domcontentloaded'
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
      'Season 100 of 100'
    );

    const postImportReload =
      await exportPortable(page);

    assertPortableFoundation(
      postImportReload.save
    );

    expect(
      postImportReload.save.current
        ?.season
    ).toBe(2425);

    expect(
      postImportReload.save.current
        ?.phase
    ).toBe(
      'season-complete'
    );

    expect(
      postImportReload.save
        .summaries
    ).toHaveLength(
      initialSummaryCount +
      TOTAL_SEASONS
    );

    expect(
      postImportReload.save
        .histories
    ).toHaveLength(932);

    for (
      const [teamId, record]
      of postImportReload.save
        .histories
    ) {
      expect(
        record.history,
        `Imported team ${teamId} must retain ${TOTAL_SEASONS} histories after reload.`
      ).toHaveLength(
        initialHistoryLengths.get(
          teamId
        ) + TOTAL_SEASONS
      );
    }

    assertChallengeIntegrity(
      postImportReload.save.current
        ?.challenge,
      CHALLENGE_SEASONS
    );

    expect(
      postImportReload.save.current
        ?.challenge
    ).toEqual(finalChallenge);

    console.log(
      'CHPCC_400_COMPLETE ' +
        JSON.stringify({
          completedSeasons:
            TOTAL_SEASONS,
          calendarSeason:
            postImportReload.save.current
              ?.season,
          phase:
            postImportReload.save.current
              ?.phase,
          summaryCount:
            postImportReload.save
              .summaries.length,
          historyCount:
            postImportReload.save
              .histories.length,
          directoryCount:
            postImportReload.save
              .directory?.length,
          rewardedSeasonCount:
            postImportReload.save.current
              ?.challenge
              ?.rewardedSeasons
              ?.length,
          challengeSeasonCount:
            postImportReload.save.current
              ?.challenge
              ?.seasons
              ?.length,
          capital:
            postImportReload.save.current
              ?.challenge
              ?.capital,
          totalEarned:
            postImportReload.save.current
              ?.challenge
              ?.totalEarned,
          majorTitles:
            postImportReload.save.current
              ?.challenge
              ?.majorTitles,
          exportBytes:
            Buffer.byteLength(
              postImportReload.text,
              'utf8'
            ),
          totalDurationMs:
            Date.now() -
            benchmarkStartedAt
        })
    );
  }
);
