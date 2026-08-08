import { afterEach, describe, expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..", "..");
const checker = resolve(import.meta.dir, "verify-public-boundary.ts");
const fixture = resolve(root, "apps", "platform-web", "boundary-fixture.txt");

afterEach(async () => {
  await rm(fixture, { force: true });
});

describe("publication boundary", () => {
  test("rejects a production-instance identifier anywhere in source", async () => {
    const token = ["hu", "kuk", "ca"].join("");
    await expectRejected(`production=${token}.org\n`, "forbidden");
  });

  test("rejects legacy application schemas and versioned API paths", async () => {
    const legacySchema = `${["qualified-opinion.fixture", "v"].join(".")}2`;
    const legacyRoute = `${["/api", "v"].join("/")}1/issues`;
    await expectRejected(
      `${legacySchema}\n${legacyRoute}\n`,
      "Forbidden public-boundary pattern",
    );
  });
});

async function expectRejected(content: string, expected: string) {
  await writeFile(fixture, content, "utf8");
  const result = Bun.spawnSync({
    cmd: [process.execPath, checker],
    cwd: root,
    env: process.env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const output =
    new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  expect(result.exitCode).not.toBe(0);
  expect(output.toLocaleLowerCase()).toContain(expected.toLocaleLowerCase());
  await rm(fixture, { force: true });
}
