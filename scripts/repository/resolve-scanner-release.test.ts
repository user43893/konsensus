import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..", "..");
const resolver = resolve(import.meta.dir, "resolve-scanner-release.sh");
const ciWorkflow = resolve(root, ".github", "workflows", "ci.yml");
const secretScanWorkflow = resolve(
  root,
  ".github",
  "workflows",
  "secret-scan.yml",
);

const releases = [
  {
    arch: "X64",
    output:
      "gitleaks_8.30.1_linux_x64.tar.gz\t551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb\n",
    scanner: "gitleaks",
  },
  {
    arch: "ARM64",
    output:
      "gitleaks_8.30.1_linux_arm64.tar.gz\te4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080\n",
    scanner: "gitleaks",
  },
  {
    arch: "X64",
    output:
      "trufflehog_3.95.9_linux_amd64.tar.gz\tf6d1106b85107d79527ed7a5b98b592beadd8b770dc3c9e8c1ad99e1b2cf127e\n",
    scanner: "trufflehog",
  },
  {
    arch: "ARM64",
    output:
      "trufflehog_3.95.9_linux_arm64.tar.gz\t9d9c2ec4ea36a089a9c5aaafe1969d176013ddf9f44d68e8cd75291aed8c83ed\n",
    scanner: "trufflehog",
  },
] as const;

describe("CI scanner release selection", () => {
  for (const release of releases) {
    test(`selects ${release.scanner} for ${release.arch}`, () => {
      const result = runResolver(release.scanner, release.arch);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toBe(release.output);
    });
  }

  test("fails closed when RUNNER_ARCH is unset or unsupported", () => {
    for (const arch of [undefined, "", "ARM", "X86", "arm64"]) {
      const result = runResolver("gitleaks", arch);
      expect(result.exitCode).toBe(64);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Unsupported scanner or RUNNER_ARCH");
    }
  });

  test("fails closed for an unknown scanner", () => {
    const result = runResolver("unknown", "ARM64");
    expect(result.exitCode).toBe(64);
    expect(result.stdout).toBe("");
  });

  test("pins both required checks to the reviewed runner", async () => {
    const [ciSource, secretScanSource] = await Promise.all([
      readFile(ciWorkflow, "utf8"),
      readFile(secretScanWorkflow, "utf8"),
    ]);
    for (const source of [ciSource, secretScanSource]) {
      const runnerLines = source
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("runs-on:"));
      expect(runnerLines).toEqual(["runs-on: ubuntu-24.04"]);
      expect(source).not.toContain("CI_RUNNER_LABEL");
    }
    expect(
      secretScanSource.match(/resolve-scanner-release[.]sh/g)?.length,
    ).toBe(2);
  });
});

function runResolver(scanner: string, arch: string | undefined) {
  const env = { ...process.env };
  env.RUNNER_ARCH = arch;
  const result = Bun.spawnSync(["bash", resolver, scanner], {
    cwd: root,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stderr: new TextDecoder().decode(result.stderr),
    stdout: new TextDecoder().decode(result.stdout),
  };
}
