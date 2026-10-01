# CHP release-candidate gate

This gate targets one exact immutable Cloudflare deployment URL after the fast preview suite has passed.

Initial coverage:

- deterministic random seed installed before application code
- complete regular season, Cup, playoffs, playouts, qualifiers, and season finalization through the real UI action
- verified season-complete checkpoint
- portable-save version 4 and exact 932-team directory
- permanent season record and next-season destination map
- next-season transition to 2027/28
- removal of the consumed nextLeagueAssignments map
- new-season zero-GP state and reload persistence
- portable export/import round-trip from a completed season
- restored completed-season state surviving reload
- browser, console, network, analytics, and persistence checks inherited from the shared fixture

This is the first release-candidate gate. Additional phase-aware export/import, deeper Create Club chain validation, statistics regressions, Cup-specific assertions, and longer benchmarks remain planned.
