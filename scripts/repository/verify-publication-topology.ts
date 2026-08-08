#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = "PUBLICATION-PROVENANCE.json";
const expectedRoot = resolve(import.meta.dir, "..", "..");
const controllerSourceRevision =
  "6277f328d8c8b539d21eae6e64471078acae7bbd" as const;

type PackageIdentity = {
  name: string;
  path: string;
  private: boolean;
  version: string;
};

type PublicationProvenance = {
  history: {
    expectedRootCount: 1;
    mode: "parentless-standalone";
  };
  repository: {
    id: string;
    releaseBoundary: "current-v3-only";
  };
  rootPackage: {
    name: string;
    private: boolean;
    version: string;
    workspaces: string[];
  };
  schema: "standalone-publication-provenance-current";
  sourceRevision: {
    algorithm: "git-commit-sha1";
    commit: typeof controllerSourceRevision;
    projection: "country-agnostic-current-v3";
  };
  sourceTree: {
    algorithm: "sha256-path-length-content-current";
    excludes: ["PUBLICATION-PROVENANCE.json"];
    sha256: string;
  };
  topology: {
    forbiddenPathPrefixes: string[];
    requiredPaths: string[];
    topLevelPaths: string[];
    workspacePackages: PackageIdentity[];
  };
};

function git(arguments_: string[]): Buffer {
  return execFileSync(
    "git",
    ["--no-replace-objects", "-C", expectedRoot, ...arguments_],
    {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30_000,
    },
  );
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    throw new TypeError(`${label} has unexpected fields`);
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function normalizedPath(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value === "" ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value !== value.normalize("NFC") ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 0x20 || codePoint === 0x7f;
    }) ||
    value
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[ .]$/u.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
      )
  ) {
    throw new TypeError(`${label} must be a normalized relative path`);
  }
  return value;
}

function nonEmptyText(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value === "" ||
    value !== value.normalize("NFC")
  ) {
    throw new TypeError(`${label} must be non-empty normalized text`);
  }
  return value;
}

function sortedUniquePaths(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  const paths = value.map((entry, index) =>
    normalizedPath(entry, `${label}[${index}]`),
  );
  if (
    new Set(paths).size !== paths.length ||
    JSON.stringify(paths) !== JSON.stringify([...paths].sort(compareText))
  ) {
    throw new TypeError(`${label} must be sorted and unique`);
  }
  return paths;
}

function textArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return value.map((entry, index) => nonEmptyText(entry, `${label}[${index}]`));
}

function parsePackageIdentity(value: unknown, label: string): PackageIdentity {
  const candidate = record(value, label);
  exactKeys(candidate, ["name", "path", "private", "version"], label);
  if (typeof candidate.private !== "boolean") {
    throw new TypeError(`${label}.private must be boolean`);
  }
  return {
    name: nonEmptyText(candidate.name, `${label}.name`),
    path: normalizedPath(candidate.path, `${label}.path`),
    private: candidate.private,
    version: nonEmptyText(candidate.version, `${label}.version`),
  };
}

function parseManifest(value: unknown): PublicationProvenance {
  const candidate = record(value, manifestPath);
  exactKeys(
    candidate,
    [
      "history",
      "repository",
      "rootPackage",
      "schema",
      "sourceRevision",
      "sourceTree",
      "topology",
    ],
    manifestPath,
  );
  if (candidate.schema !== "standalone-publication-provenance-current") {
    throw new TypeError(`${manifestPath} has an invalid schema`);
  }

  const history = record(candidate.history, "history");
  exactKeys(history, ["expectedRootCount", "mode"], "history");
  if (
    history.expectedRootCount !== 1 ||
    history.mode !== "parentless-standalone"
  ) {
    throw new TypeError("history must require one parentless standalone root");
  }

  const repository = record(candidate.repository, "repository");
  exactKeys(repository, ["id", "releaseBoundary"], "repository");
  if (repository.releaseBoundary !== "current-v3-only") {
    throw new TypeError("repository.releaseBoundary must be current-v3-only");
  }

  const rootPackage = record(candidate.rootPackage, "rootPackage");
  exactKeys(
    rootPackage,
    ["name", "private", "version", "workspaces"],
    "rootPackage",
  );
  if (typeof rootPackage.private !== "boolean") {
    throw new TypeError("rootPackage.private must be boolean");
  }

  const sourceTree = record(candidate.sourceTree, "sourceTree");
  exactKeys(sourceTree, ["algorithm", "excludes", "sha256"], "sourceTree");
  if (
    sourceTree.algorithm !== "sha256-path-length-content-current" ||
    JSON.stringify(sourceTree.excludes) !== JSON.stringify([manifestPath]) ||
    typeof sourceTree.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(sourceTree.sha256)
  ) {
    throw new TypeError(
      "sourceTree does not define the exact current digest contract",
    );
  }

  const sourceRevision = record(candidate.sourceRevision, "sourceRevision");
  exactKeys(
    sourceRevision,
    ["algorithm", "commit", "projection"],
    "sourceRevision",
  );
  if (
    sourceRevision.algorithm !== "git-commit-sha1" ||
    sourceRevision.commit !== controllerSourceRevision ||
    sourceRevision.projection !== "country-agnostic-current-v3"
  ) {
    throw new TypeError(
      "sourceRevision does not bind the reviewed controller commit",
    );
  }

  const topology = record(candidate.topology, "topology");
  exactKeys(
    topology,
    [
      "forbiddenPathPrefixes",
      "requiredPaths",
      "topLevelPaths",
      "workspacePackages",
    ],
    "topology",
  );
  if (!Array.isArray(topology.workspacePackages)) {
    throw new TypeError("topology.workspacePackages must be an array");
  }
  const workspacePackages = topology.workspacePackages.map((entry, index) =>
    parsePackageIdentity(entry, `topology.workspacePackages[${index}]`),
  );
  if (
    JSON.stringify(workspacePackages.map(({ path }) => path)) !==
    JSON.stringify(workspacePackages.map(({ path }) => path).sort(compareText))
  ) {
    throw new TypeError("topology.workspacePackages must be sorted by path");
  }

  return {
    history: {
      expectedRootCount: 1,
      mode: "parentless-standalone",
    },
    repository: {
      id: nonEmptyText(repository.id, "repository.id"),
      releaseBoundary: "current-v3-only",
    },
    rootPackage: {
      name: nonEmptyText(rootPackage.name, "rootPackage.name"),
      private: rootPackage.private,
      version: nonEmptyText(rootPackage.version, "rootPackage.version"),
      workspaces: textArray(rootPackage.workspaces, "rootPackage.workspaces"),
    },
    schema: "standalone-publication-provenance-current",
    sourceRevision: {
      algorithm: "git-commit-sha1",
      commit: controllerSourceRevision,
      projection: "country-agnostic-current-v3",
    },
    sourceTree: {
      algorithm: "sha256-path-length-content-current",
      excludes: [manifestPath],
      sha256: sourceTree.sha256,
    },
    topology: {
      forbiddenPathPrefixes: sortedUniquePaths(
        topology.forbiddenPathPrefixes,
        "topology.forbiddenPathPrefixes",
      ),
      requiredPaths: sortedUniquePaths(
        topology.requiredPaths,
        "topology.requiredPaths",
      ),
      topLevelPaths: sortedUniquePaths(
        topology.topLevelPaths,
        "topology.topLevelPaths",
      ),
      workspacePackages,
    },
  };
}

function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

async function sourcePaths(): Promise<string[]> {
  const output = git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  const paths: string[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    const raw = output.subarray(start, index);
    start = index + 1;
    if (raw.length === 0) continue;
    const path = raw.toString("utf8");
    if (!Buffer.from(path, "utf8").equals(raw)) {
      throw new Error("Repository path is not valid UTF-8");
    }
    normalizedPath(path, "repository path");
    const stats = await lstat(resolve(expectedRoot, path)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      },
    );
    if (!stats) continue;
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`Repository source entry is not a regular file: ${path}`);
    }
    paths.push(path);
  }
  if (start !== output.length) {
    throw new Error("Git returned an unterminated path list");
  }
  paths.sort(compareText);
  if (new Set(paths).size !== paths.length) {
    throw new Error("Repository source contains duplicate paths");
  }
  return paths;
}

async function sourceDigest(paths: readonly string[]): Promise<string> {
  const hash = createHash("sha256");
  hash.update("standalone-publication-source-tree-current\0");
  for (const path of paths) {
    if (path === manifestPath) continue;
    const content = await readFile(resolve(expectedRoot, path));
    const metadata = Buffer.from(
      JSON.stringify({ bytes: content.byteLength, path }),
      "utf8",
    );
    hash.update(metadata);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function commitParents(commit: string): string[] {
  const object = git(["cat-file", "-p", commit]).toString("utf8");
  const header = object.split("\n\n", 1)[0] ?? "";
  return header
    .split("\n")
    .filter((line) => line.startsWith("parent "))
    .map((line) => line.slice("parent ".length));
}

function historyRootCount(): number {
  const head = git(["rev-parse", "HEAD^{commit}"]).toString("utf8").trim();
  const pending = [head];
  const visited = new Set<string>();
  const roots = new Set<string>();
  while (pending.length > 0) {
    const commit = pending.pop();
    if (!commit || visited.has(commit)) continue;
    if (!/^[a-f0-9]{40,64}$/u.test(commit)) {
      throw new Error("Git history contains an invalid commit identifier");
    }
    visited.add(commit);
    if (visited.size > 100_000) {
      throw new Error("Git history exceeds the publication verifier bound");
    }
    const parents = commitParents(commit);
    if (parents.length === 0) roots.add(commit);
    else pending.push(...parents);
  }
  return roots.size;
}

async function packageIdentity(path: string): Promise<PackageIdentity> {
  const packagePath = `${path}/package.json`;
  const value = record(
    JSON.parse(await readFile(resolve(expectedRoot, packagePath), "utf8")),
    packagePath,
  );
  return {
    name: nonEmptyText(value.name, `${packagePath}.name`),
    path,
    private: value.private === true,
    version: nonEmptyText(value.version, `${packagePath}.version`),
  };
}

export async function verifyPublicationTopology(options?: {
  printSourceSha256?: boolean;
}): Promise<void> {
  const actualRoot = resolve(
    git(["rev-parse", "--show-toplevel"]).toString("utf8").trim(),
  );
  if (actualRoot !== expectedRoot) {
    throw new Error(
      "Publication verifier is not running from its repository root",
    );
  }
  const manifest = parseManifest(
    JSON.parse(await readFile(resolve(expectedRoot, manifestPath), "utf8")),
  );
  const paths = await sourcePaths();
  const digest = await sourceDigest(paths);
  if (options?.printSourceSha256) {
    console.log(digest);
    return;
  }
  if (digest !== manifest.sourceTree.sha256) {
    throw new Error(
      `Current source-tree digest ${digest} does not match ${manifestPath}`,
    );
  }
  if (historyRootCount() !== manifest.history.expectedRootCount) {
    throw new Error("Git history is not derived from one parentless root");
  }
  const pathSet = new Set(paths);
  for (const path of manifest.topology.requiredPaths) {
    if (!pathSet.has(path))
      throw new Error(`Required source path is missing: ${path}`);
  }
  for (const prefix of manifest.topology.forbiddenPathPrefixes) {
    const violation = paths.find(
      (path) => path === prefix || path.startsWith(`${prefix}/`),
    );
    if (violation) throw new Error(`Forbidden topology path: ${violation}`);
  }
  const topLevelPaths = [
    ...new Set(paths.map((path) => path.split("/")[0] ?? "")),
  ]
    .filter(Boolean)
    .sort(compareText);
  if (
    JSON.stringify(topLevelPaths) !==
    JSON.stringify(manifest.topology.topLevelPaths)
  ) {
    throw new Error(
      "Repository top-level topology differs from the reviewed manifest",
    );
  }

  const rootPackage = record(
    JSON.parse(await readFile(resolve(expectedRoot, "package.json"), "utf8")),
    "package.json",
  );
  const actualRootPackage = {
    name: rootPackage.name,
    private: rootPackage.private === true,
    version: rootPackage.version,
    workspaces: rootPackage.workspaces ?? [],
  };
  if (
    JSON.stringify(actualRootPackage) !== JSON.stringify(manifest.rootPackage)
  ) {
    throw new Error("Root package identity differs from the reviewed manifest");
  }

  const discoveredWorkspacePaths = paths
    .filter((path) =>
      /^(?:apps|instances|packages)\/[^/]+\/package[.]json$/u.test(path),
    )
    .map((path) => path.slice(0, -"/package.json".length))
    .sort(compareText);
  const expectedWorkspacePaths = manifest.topology.workspacePackages.map(
    ({ path }) => path,
  );
  if (
    JSON.stringify(discoveredWorkspacePaths) !==
    JSON.stringify(expectedWorkspacePaths)
  ) {
    throw new Error(
      "Workspace package topology differs from the reviewed manifest",
    );
  }
  const actualWorkspacePackages = await Promise.all(
    expectedWorkspacePaths.map(packageIdentity),
  );
  if (
    JSON.stringify(actualWorkspacePackages) !==
    JSON.stringify(manifest.topology.workspacePackages)
  ) {
    throw new Error(
      "Workspace package identity differs from the reviewed manifest",
    );
  }
  console.log(
    `Verified standalone provenance, one history root, and ${paths.length} exact source paths (${digest}).`,
  );
}

if (import.meta.main) {
  const arguments_ = process.argv.slice(2);
  if (
    arguments_.length > 1 ||
    (arguments_.length === 1 && arguments_[0] !== "--print-source-sha256")
  ) {
    throw new Error(
      "Usage: verify-publication-topology.ts [--print-source-sha256]",
    );
  }
  await verifyPublicationTopology({
    printSourceSha256: arguments_[0] === "--print-source-sha256",
  });
}
