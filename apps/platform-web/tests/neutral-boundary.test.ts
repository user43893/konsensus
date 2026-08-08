import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const platformRoot = join(import.meta.dir, "..");
const referenceInstanceRoot = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "instances",
  "conformance-demo",
);

describe("jurisdiction-neutral frontend boundary", () => {
  test("depends only on neutral contracts and the selected reference instance", async () => {
    const manifest = await Bun.file(join(platformRoot, "package.json")).json();
    expect(Object.keys(manifest.dependencies).sort()).toEqual(
      [
        "@konsensus/instance-conformance-demo",
        "@konsensus/instance-profile",
        "@konsensus/public-api",
        "next",
        "react",
        "react-dom",
      ].sort(),
    );
  });

  test("contains no product-specific imports, environment reads, or copy", async () => {
    const productToken = ["hu", "kuk", "ca"].join("");
    const oldEnvironmentPrefix = ["HU", "KUK", "CA_"].join("");
    const forbidden = [
      productToken,
      oldEnvironmentPrefix.toLocaleLowerCase(),
      ...["db", "domain", "config"].map((name) =>
        ["@konsensus", name].join("/"),
      ),
    ];
    const files = await sourceFiles([platformRoot, referenceInstanceRoot]);

    for (const file of files) {
      const source = (await Bun.file(file).text()).toLocaleLowerCase();
      for (const token of forbidden) {
        expect(source, `${file} must not contain ${token}`).not.toContain(
          token,
        );
      }
    }
  });

  test("loads public records through PublicApiClient", async () => {
    const source = await Bun.file(
      join(platformRoot, "components", "public-read.tsx"),
    ).text();
    expect(source).toContain("PublicApiClient");
    expect(source).not.toContain("credentials:");
    expect(source).not.toContain(["@konsensus", "db"].join("/"));
  });

  test("renders current profile evidence and public V3 proof links", async () => {
    const source = await Bun.file(
      join(platformRoot, "app", "[[...segments]]", "page.tsx"),
    ).text();
    expect(source).toContain("profile.qualification.evidenceTypes");
    expect(source).toContain("/.well-known/deployment.json");
    expect(source).toContain("/.well-known/source.json");
  });
});

async function sourceFiles(roots: string[]) {
  const files: string[] = [];
  const glob = new Bun.Glob("**/*.{css,json,md,ts,tsx}");
  for (const root of roots) {
    for await (const file of glob.scan({
      absolute: true,
      cwd: root,
      dot: true,
      onlyFiles: true,
    })) {
      if (!file.includes("/.next/") && !file.includes("/node_modules/")) {
        files.push(file);
      }
    }
  }
  return files;
}
