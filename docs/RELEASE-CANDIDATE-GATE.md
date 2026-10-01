# CHP release-candidate gate

This gate targets one exact immutable Cloudflare deployment after the fast preview suite has passed.

Coverage now includes:

- deterministic complete-season lifecycle and checkpoint
- Cup, playoffs, playouts, qualifiers, season finalization and next-season transition
- portable-save version 4 and exact 932-team directory
- unique and identical active/directory team-ID sets
- exact 64-division topology and tier capacities
- permanent summaries and 932 histories
- completed-season export/import round trip
- phase-aware exports at fresh regular season, regular-complete, season-complete and new season
- custom-club creation, stable ID, capacity preservation, season transition, export/import and reload survival
- five deterministic seasons with exact history-row growth
- removal of consumed nextLeagueAssignments after each season transition
- browser, console, network, analytics, persistence and test-isolation checks inherited from the shared fixture

The workflow remains manual while this bundled expansion is validated. Production deployment is not performed by this workflow.
