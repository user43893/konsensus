#!/usr/bin/env bash
set -euo pipefail

scanner="${1:-}"
runner_arch="${RUNNER_ARCH:-}"

case "$scanner:$runner_arch" in
  gitleaks:X64)
    archive_name="gitleaks_8.30.1_linux_x64.tar.gz"
    archive_sha256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
    ;;
  gitleaks:ARM64)
    archive_name="gitleaks_8.30.1_linux_arm64.tar.gz"
    archive_sha256="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"
    ;;
  trufflehog:X64)
    archive_name="trufflehog_3.95.9_linux_amd64.tar.gz"
    archive_sha256="f6d1106b85107d79527ed7a5b98b592beadd8b770dc3c9e8c1ad99e1b2cf127e"
    ;;
  trufflehog:ARM64)
    archive_name="trufflehog_3.95.9_linux_arm64.tar.gz"
    archive_sha256="9d9c2ec4ea36a089a9c5aaafe1969d176013ddf9f44d68e8cd75291aed8c83ed"
    ;;
  *)
    printf 'Unsupported scanner or RUNNER_ARCH: scanner=%s RUNNER_ARCH=%s\n' \
      "${scanner:-<unset>}" "${runner_arch:-<unset>}" >&2
    exit 64
    ;;
esac

printf '%s\t%s\n' "$archive_name" "$archive_sha256"
