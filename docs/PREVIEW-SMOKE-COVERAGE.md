# Fast preview smoke coverage

The manually triggered preview workflow tests one exact HTTPS deployment URL in desktop Chromium and an iPhone-style Chromium profile.

The fast gate covers:

- successful main-document and application bootstrap
- clean reload
- expected visible version
- division navigation with desktop click and mobile touch
- Statistics modal navigation
- mobile page-shell overflow
- Create Club availability, controls, official-place selection, D6 proposal, commit, and persistence for CHP v1.108 and later
- one-game simulation, standings change, Create Club locking, and reload persistence
- idle portable-save download, JSON parsing, and exact active-team count
- uncaught page errors, browser console errors, and failed non-analytics requests
- analytics suppression before application code runs
- browser-context isolation between tests

This suite is intentionally bounded. Full-season, Cup, postseason, import, deep-history, geographic, performance, nightly, and weekly testing belong in later workflows.
