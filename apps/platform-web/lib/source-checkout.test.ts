import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectGitSourceCheckout } from "./source-checkout";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Git source checkout inspection", () => {
  test("hashes the tracked-file inventory and rejects later changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "platform-source-"));
    temporaryDirectories.push(directory);
    git(directory, ["init", "--quiet"]);
    git(directory, ["config", "user.email", "source-test@example.test"]);
    git(directory, ["config", "user.name", "Source Test"]);
    const nestedDirectory = join(directory, "apps", "frontend");
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(join(directory, "README.md"), "public source\n");
    await writeFile(join(nestedDirectory, "app.ts"), "export {};\n");
    git(directory, ["add", "."]);
    git(directory, ["commit", "--quiet", "-m", "initial"]);

    const first = inspectGitSourceCheckout(nestedDirectory);
    const second = inspectGitSourceCheckout(directory);
    expect(first).toEqual(second);
    expect(first.headCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(first.sourceInventory.trackedFiles).toBe(2);
    expect(first.sourceInventory.value).toMatch(/^[0-9a-f]{64}$/);

    await writeFile(join(directory, "README.md"), "modified source\n");
    expect(() => inspectGitSourceCheckout(nestedDirectory)).toThrow(
      "requires a clean Git checkout",
    );
  });
});

function git(directory: string, arguments_: readonly string[]) {
  execFileSync("git", arguments_, {
    cwd: directory,
    stdio: "ignore",
  });
}
