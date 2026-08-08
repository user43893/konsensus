# Konsensus

Konsensus is a ready-made web frontend for publishing expert opinion on
public questions — "do the people qualified to judge this consider it
lawful?" — in a way readers can verify. Every quoted opinion links to the
public statement it came from, and every vote cast directly on the platform
comes with cryptographic proof that anyone can check in the browser.

To use it, you run your own backend (database, editorial workflow, sign-in,
voting service) and describe your deployment — country, languages, who
counts as qualified, how votes are weighted — in a single JSON profile.
This repository provides:

- the frontend app (`apps/platform-web`), ready to deploy;
- browser-side verification, so readers can check vote proofs and the
  signed list of eligible voters without trusting your server; and
- a demo instance filled with entirely invented data, so you can see every
  page working before you build a backend.

Nothing here refers to any real deployment: an automated check rejects
country-specific names, hostnames, credentials, and provider details, so
what you fork is genuinely neutral. Decisions about who may vote, what is
published, and how long data is kept stay with you, the operator.

## Checking a release

```sh
bun install --frozen-lockfile
bun run release:check
```

One command runs the tests, type checks, lint, a production build,
dependency and license audits, and a secret scan. Deployment settings are
documented in [`apps/platform-web/README.md`](./apps/platform-web/README.md).

## Related repositories

- [qualified-opinion-protocol](https://github.com/konsensus-platform/qualified-opinion-protocol)
  — the voting protocol and offline verifier behind the proof checks
- [gcs-attested-registration-voting](https://github.com/konsensus-platform/gcs-attested-registration-voting)
  — a backend reference that runs registration and voting inside attested
  cloud hardware
