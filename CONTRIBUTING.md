# Contributing

Keep portable modules jurisdiction- and instance-neutral. They must receive
validated policy and configuration through explicit interfaces rather than
importing a relying application's routes, branding, trust roots, credential
classes, or environment variables.

Changes to the public API or instance-profile contract need conformance tests
against the synthetic reference demo. This repository exposes only the current
V3 signed formats; historical readers belong in separately maintained archival
verifiers rather than compatibility branches in the application shell.

Never commit credentials, private qualification evidence, editorial queues,
database exports, provider state, or production diagnostics. Use synthetic
fixtures and example configuration.

Run `bun run release:check` before proposing a release. The boundary gate must
reject production-instance identifiers, versioned legacy API paths, and
pre-V3 application schema markers.

Code contributions are Apache-2.0. Original documentation contributions are
CC BY 4.0 unless a file explicitly says otherwise.
