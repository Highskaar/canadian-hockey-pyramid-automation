# Public automation security boundaries

This repository is public. It may contain reviewed test code, non-sensitive deterministic fixtures, package manifests, workflows, and sanitized documentation.

It must never contain CHP or CHPCC application source, complete playable builds, transport archives, real player saves, personal data, credentials, private keys, API tokens, copied private history, or unsanitized failure artifacts.

Deployment credentials must be narrowly scoped GitHub secrets. Untrusted pull-request workflows must never receive deployment secrets. Production deployment must remain separately protected and manually approved until the release pipeline is mature.
