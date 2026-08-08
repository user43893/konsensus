import { lstat, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

type ContentRule = {
  excludedPaths: string[];
  forbiddenPatterns: string[];
  forbiddenTerms: string[];
  scope: "repository";
};

type BoundaryPolicy = {
  contentRules: ContentRule[];
  schema: "konsensus.public-repository-boundary";
};

const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const forbiddenPathSegments = new Set([
  ".data",
  ".vercel",
  "artifacts",
  "dump",
  "dumps",
  "evidence",
  "private",
  "qa-screenshots",
  "repo-archives",
  "tmp",
]);

function normalizedRelativePath(value: unknown, label: string): string {
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

function parsePolicy(value: unknown): BoundaryPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("PUBLICATION-BOUNDARY.json must be an object");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schema !== "konsensus.public-repository-boundary" ||
    !Array.isArray(candidate.contentRules)
  ) {
    throw new TypeError("PUBLICATION-BOUNDARY.json has an invalid schema");
  }
  const contentRules = candidate.contentRules.map((rawRule, ruleIndex) => {
    if (!rawRule || typeof rawRule !== "object" || Array.isArray(rawRule)) {
      throw new TypeError(`contentRules[${ruleIndex}] must be an object`);
    }
    const rule = rawRule as Record<string, unknown>;
    if (
      rule.scope !== "repository" ||
      !Array.isArray(rule.excludedPaths) ||
      !Array.isArray(rule.forbiddenTerms) ||
      !Array.isArray(rule.forbiddenPatterns)
    ) {
      throw new TypeError(
        `contentRules[${ruleIndex}] must define repository-wide exclusions and forbidden content`,
      );
    }
    const excludedPaths = rule.excludedPaths.map((path, pathIndex) =>
      normalizedRelativePath(
        path,
        `contentRules[${ruleIndex}].excludedPaths[${pathIndex}]`,
      ),
    );
    if (new Set(excludedPaths).size !== excludedPaths.length) {
      throw new TypeError(
        `contentRules[${ruleIndex}].excludedPaths contains duplicates`,
      );
    }
    const forbiddenTerms = rule.forbiddenTerms.map((term, termIndex) => {
      if (
        typeof term !== "string" ||
        term === "" ||
        term !== term.normalize("NFC")
      ) {
        throw new TypeError(
          `contentRules[${ruleIndex}].forbiddenTerms[${termIndex}] must be non-empty normalized text`,
        );
      }
      return term;
    });
    const forbiddenPatterns = rule.forbiddenPatterns.map(
      (pattern, patternIndex) => {
        if (typeof pattern !== "string" || pattern === "") {
          throw new TypeError(
            `contentRules[${ruleIndex}].forbiddenPatterns[${patternIndex}] must be non-empty`,
          );
        }
        try {
          new RegExp(pattern, "u");
        } catch {
          throw new TypeError(
            `contentRules[${ruleIndex}].forbiddenPatterns[${patternIndex}] is not a valid regular expression`,
          );
        }
        return pattern;
      },
    );
    return {
      excludedPaths,
      forbiddenPatterns,
      forbiddenTerms,
      scope: "repository" as const,
    };
  });
  return {
    contentRules,
    schema: "konsensus.public-repository-boundary",
  };
}

function environmentFileIsForbidden(path: string): boolean {
  const name = path.split("/").at(-1)?.toLowerCase() ?? "";
  return name.startsWith(".env") && !/^\.env(?:\.[^.]+)?\.example$/u.test(name);
}

function assertSafePath(path: string): void {
  const segments = path.toLowerCase().split("/");
  if (
    segments.some((segment) => forbiddenPathSegments.has(segment)) ||
    environmentFileIsForbidden(path) ||
    /(^|\/)gha-creds-[^/]+\.json$/iu.test(path) ||
    /(^|\/)gitleaks-report\.[^/]+$/iu.test(path) ||
    /\.(?:db|dump|key|p12|pem|pfx|sqlite)$/iu.test(path)
  ) {
    throw new Error(`Forbidden public-repository path: ${path}`);
  }
}

async function repositoryFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      const absolute = resolve(directory, entry.name);
      const path = relative(root, absolute).split(sep).join("/");
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) {
        throw new Error(`Public repository contains a symlink: ${path}`);
      }
      if (stats.isDirectory()) {
        await visit(absolute);
      } else if (stats.isFile()) {
        normalizedRelativePath(path, "repository path");
        assertSafePath(path);
        files.push(path);
      } else {
        throw new Error(`Public repository contains a non-file entry: ${path}`);
      }
    }
  }
  await visit(root);
  const portablePaths = files.map((path) =>
    path.normalize("NFKC").toLocaleLowerCase("en-US"),
  );
  if (new Set(portablePaths).size !== portablePaths.length) {
    throw new Error(
      "Public repository paths collide after Unicode normalization and case folding",
    );
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dir, "..", "..");
  const policy = parsePolicy(
    await Bun.file(resolve(root, "PUBLICATION-BOUNDARY.json")).json(),
  );
  const files = await repositoryFiles(root);
  for (const rule of policy.contentRules) {
    for (const path of files) {
      if (rule.excludedPaths.includes(path)) continue;
      const bytes = new Uint8Array(
        await Bun.file(resolve(root, path)).arrayBuffer(),
      );
      if (bytes.includes(0)) continue;
      const text = new TextDecoder("utf-8", { fatal: true })
        .decode(bytes)
        .normalize("NFC");
      const foldedText = text.toLocaleLowerCase("en-US");
      const forbiddenTerm = rule.forbiddenTerms.find((term) =>
        foldedText.includes(term.toLocaleLowerCase("en-US")),
      );
      if (forbiddenTerm) {
        throw new Error(
          `Forbidden public-boundary term ${JSON.stringify(forbiddenTerm)} in ${path}`,
        );
      }
      const forbiddenPattern = rule.forbiddenPatterns.find((pattern) =>
        new RegExp(pattern, "u").test(text),
      );
      if (forbiddenPattern) {
        throw new Error(
          `Forbidden public-boundary pattern ${JSON.stringify(forbiddenPattern)} in ${path}`,
        );
      }
    }
  }
  console.log(
    `Public repository boundary verified ${files.length} non-generated files.`,
  );
}

if (import.meta.main) {
  await main();
}
