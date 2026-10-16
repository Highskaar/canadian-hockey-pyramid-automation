const {
  test,
  expect,
  installDeterministicRandom,
  installExportCapture,
  openReadyApp,
  exportPortable,
  assertPortableFoundation,
  directoryEntries
} = require('./chpcc-rc-helpers');

const FIRST_CLUB = 'Automation Later Season Club';
const SECOND_CLUB = 'Automation Consecutive Season Club';

function entryByName(save, name) {
  return directoryEntries(save).find(
    entry => entry?.[1]?.[0] === name
  );
}

function teamIdsInLeague(league) {
  return (league?.teams || []).map(team =>
    typeof team === 'string' ? team : team?.id
  );
}

function placementOf(save, teamId) {
  for (const league of save.current?.leagues || []) {
    if (teamIdsInLeague(league).includes(teamId)) {
      return {
        leagueId: league.id ?? league.key ?? league.name,
        tier: league.tier
      };
    }
  }
  return null;
}

function activeDifference(before, after) {
  const afterIds = new Set(after.current?.activeTeamIds || []);
  return (before.current?.activeTeamIds || []).filter(
    teamId => !afterIds.has(teamId)
  );
}

async function waitForReadyReload(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.CHP_BOOTSTRAP_READY === true
  );
  await expect(page.locator('#mainView')).toBeVisible();
}

async function createD6Club(page, name) {
  await expect(page.locator('#btnCreateClub')).toBeEnabled();
  await page.locator('#btnCreateClub').click();
  await expect(
    page.getByRole('heading', {
      name: 'Create Club',
      exact: true
    })
  ).toBeVisible();

  await page.locator('#ccName').fill(name);
  await page.locator('#ccPlace').fill('Toronto');
  const place = page.locator(
    '#ccPlaces [data-cc-place]'
  ).first();
  await expect(place).toBeVisible();
  await place.click();
  await page.locator('#ccTier').selectOption('6');
  await page.locator('#ccPlan').click();
  await expect(page.locator('#ccPreview')).toContainText(
    'Proposed change'
  );
  await expect(page.locator('#ccPreview')).toContainText(
    'becomes defunct'
  );
  await expect(page.locator('#ccCommit')).toBeEnabled();
  await page.locator('#ccCommit').click();
  await expect(page.locator('#teamModal')).toBeHidden();
  await expect(page.locator('#btnCreateClub')).toBeDisabled();
}

async function expectSearchResult(page, name) {
  await page.locator('#teamSearch').fill(name);
  await expect(page.locator('#searchResults')).toContainText(name);
}

async function snapshotClub(page, name) {
  const exported = await exportPortable(page);
  assertPortableFoundation(exported.save);
  const entry = entryByName(exported.save, name);
  expect(entry, `${name} must exist in the portable directory.`).toBeTruthy();
  const teamId = entry[0];
  expect(exported.save.current.activeTeamIds).toContain(teamId);
  const placement = placementOf(exported.save, teamId);
  expect(placement, `${name} must have an active league placement.`).toBeTruthy();
  expect(placement.tier).toBe(6);
  return {
    exported,
    entry,
    teamId,
    placement
  };
}

function expectSameClub(actual, expected) {
  expect(actual.teamId).toBe(expected.teamId);
  expect(actual.entry).toEqual(expected.entry);
  expect(actual.placement).toEqual(expected.placement);
}

test(
  'later-season D6 custom clubs survive immediate and post-game reloads in consecutive seasons',
  async ({ observed }) => {
    test.setTimeout(300_000);
    const { page } = observed;

    await installDeterministicRandom(page, 415022);
    await installExportCapture(page);
    await openReadyApp(page);

    const initial = await exportPortable(page);
    assertPortableFoundation(initial.save);
    expect(initial.save.current?.season).toBe(2026);
    expect(initial.save.current?.phase).toBe('regular');
    expect(initial.save.current?.challenge).toBeFalsy();

    await page.locator('[data-sim="season"]').click();
    await expect(
      page.locator('[data-sim="next"]').first()
    ).toBeEnabled({ timeout: 60_000 });
    await page.locator('[data-sim="next"]').first().click();
    await expect(page.locator('#seasonMenu')).toContainText(
      '2027/28',
      { timeout: 60_000 }
    );

    const beforeFirst = await exportPortable(page);
    assertPortableFoundation(beforeFirst.save);
    expect(beforeFirst.save.current?.phase).toBe('regular');
    expect(beforeFirst.save.current?.challenge).toBeFalsy();

    await createD6Club(page, FIRST_CLUB);
    const firstCreated = await snapshotClub(page, FIRST_CLUB);
    const firstRemoved = activeDifference(
      beforeFirst.save,
      firstCreated.exported.save
    );
    expect(firstRemoved).toHaveLength(1);
    const firstDefunctEntry = directoryEntries(beforeFirst.save).find(
      entry => entry?.[0] === firstRemoved[0]
    );
    expect(firstDefunctEntry).toBeTruthy();
    const firstDefunctName = firstDefunctEntry[1]?.[0];
    expect(firstDefunctName).toBeTruthy();

    await waitForReadyReload(page);
    const firstImmediateReload = await snapshotClub(
      page,
      FIRST_CLUB
    );
    expectSameClub(firstImmediateReload, firstCreated);
    expect(
      firstImmediateReload.exported.save.current?.challenge
    ).toBeFalsy();
    await expectSearchResult(page, FIRST_CLUB);
    await expectSearchResult(page, firstDefunctName);

    await page.locator('[data-tier="1"]').click();
    const gamesBefore = await page
      .locator('#mainView .standings tbody tr td:nth-child(3)')
      .evaluateAll(cells =>
        cells.reduce(
          (sum, cell) => sum + Number(cell.textContent || 0),
          0
        )
      );
    await page.locator('[data-sim="one"]').click();
    await expect.poll(async () =>
      page
        .locator('#mainView .standings tbody tr td:nth-child(3)')
        .evaluateAll(cells =>
          cells.reduce(
            (sum, cell) => sum + Number(cell.textContent || 0),
            0
          )
        )
    ).toBeGreaterThan(gamesBefore);

    const firstAfterGame = await snapshotClub(page, FIRST_CLUB);
    expectSameClub(firstAfterGame, firstCreated);
    const stateAfterFirstGame = {
      season: firstAfterGame.exported.save.current?.season,
      phase: firstAfterGame.exported.save.current?.phase,
      schedule: firstAfterGame.exported.save.current?.schedule,
      leagues: firstAfterGame.exported.save.current?.leagues
    };

    await waitForReadyReload(page);
    const firstPostGameReload = await snapshotClub(
      page,
      FIRST_CLUB
    );
    expectSameClub(firstPostGameReload, firstCreated);
    expect({
      season: firstPostGameReload.exported.save.current?.season,
      phase: firstPostGameReload.exported.save.current?.phase,
      schedule: firstPostGameReload.exported.save.current?.schedule,
      leagues: firstPostGameReload.exported.save.current?.leagues
    }).toEqual(stateAfterFirstGame);

    await page.locator('[data-sim="season"]').click();
    await expect(
      page.locator('[data-sim="next"]').first()
    ).toBeEnabled({ timeout: 60_000 });
    await page.locator('[data-sim="next"]').first().click();
    await expect(page.locator('#seasonMenu')).toContainText(
      '2028/29',
      { timeout: 60_000 }
    );

    const beforeSecond = await exportPortable(page);
    assertPortableFoundation(beforeSecond.save);
    expect(entryByName(beforeSecond.save, FIRST_CLUB)?.[0]).toBe(
      firstCreated.teamId
    );
    expect(beforeSecond.save.current?.challenge).toBeFalsy();

    await createD6Club(page, SECOND_CLUB);
    const secondCreated = await snapshotClub(page, SECOND_CLUB);
    expect(secondCreated.teamId).not.toBe(firstCreated.teamId);
    expect(
      entryByName(secondCreated.exported.save, FIRST_CLUB)?.[0]
    ).toBe(firstCreated.teamId);
    expect(
      activeDifference(beforeSecond.save, secondCreated.exported.save)
    ).toHaveLength(1);

    await waitForReadyReload(page);
    const secondImmediateReload = await snapshotClub(
      page,
      SECOND_CLUB
    );
    expectSameClub(secondImmediateReload, secondCreated);
    expect(
      entryByName(
        secondImmediateReload.exported.save,
        FIRST_CLUB
      )?.[0]
    ).toBe(firstCreated.teamId);
    await expectSearchResult(page, SECOND_CLUB);

    await page.locator('[data-sim="one"]').click();
    const secondAfterGame = await snapshotClub(page, SECOND_CLUB);
    expectSameClub(secondAfterGame, secondCreated);

    await waitForReadyReload(page);
    const secondPostGameReload = await snapshotClub(
      page,
      SECOND_CLUB
    );
    expectSameClub(secondPostGameReload, secondCreated);
    expect(
      entryByName(
        secondPostGameReload.exported.save,
        FIRST_CLUB
      )?.[0]
    ).toBe(firstCreated.teamId);
    expect(
      secondPostGameReload.exported.save.current?.challenge
    ).toBeFalsy();
  }
);
