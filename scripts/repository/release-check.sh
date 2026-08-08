#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

bun install --frozen-lockfile
bun run boundary
bun run test
bun run typecheck
bun run lint
bun run build
bun run audit
bun run licenses
bun run gitleaks
