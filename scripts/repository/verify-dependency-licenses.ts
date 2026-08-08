import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

export type LockedPackage = {
  name: string;
  version: string;
};

export type InstalledPackage = LockedPackage & {
  license: string;
  path: string;
};

type LicenseOverride = LockedPackage & {
  license: string;
  licenseFile: string;
  licenseFileSha256: string;
};

const FORBIDDEN_LICENSE_PATTERNS = [
  /\bAGPL(?:-\d(?:\.\d)?)?(?:-only|-or-later)?\b/i,
  /(?:^|[\s(])GPL(?:-\d(?:\.\d)?)?(?:-only|-or-later)?(?:$|[\s)])/i,
  /\bSSPL(?:-\d(?:\.\d)?)?\b/i,
  /\bBUSL(?:-\d(?:\.\d)?)?\b/i,
  /\bCommons-Clause\b/i,
  /\bElastic-License\b/i,
] as const;

export function lockedPackagesFromBunLock(source: string): LockedPackage[] {
  const packages = new Map<string, LockedPackage>();
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s{4}"[^"]+": \["([^"]+)"/.exec(line);
    if (!match) continue;
    const coordinate = match[1];
    const separator = coordinate.lastIndexOf("@");
    if (separator < 1 || separator === coordinate.length - 1) continue;
    const name = coordinate.slice(0, separator);
    const version = coordinate.slice(separator + 1);
    if (!name || !version || version.startsWith("workspace:")) continue;
    packages.set(`${name}\0${version}`, { name, version });
  }
  return [...packages.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.version.localeCompare(right.version),
  );
}

export function normalizedLicense(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const license = value.trim();
    if (
      /^(?:SEE LICEN[CS]E IN\b|UNLICEN[CS]ED$|PROPRIETARY$|NONE$)/i.test(
        license,
      )
    ) {
      return "UNKNOWN";
    }
    return license;
  }
  if (Array.isArray(value)) {
    const licenses = value
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : entry &&
              typeof entry === "object" &&
              "type" in entry &&
              typeof entry.type === "string"
            ? entry.type
            : "",
      )
      .filter(Boolean);
    if (licenses.length > 0) return licenses.join(" OR ");
  }
  return "UNKNOWN";
}

export function forbiddenLicenseReason(license: string): string | null {
  return (
    FORBIDDEN_LICENSE_PATTERNS.find((pattern) => pattern.test(license))
      ?.source ?? null
  );
}

async function packageJsonPaths(root: string): Promise<string[]> {
  const bunStore = join(root, "node_modules", ".bun");
  const packageJsons: string[] = [];
  const packageRoots = await readdir(bunStore, { withFileTypes: true });
  for (const packageRoot of packageRoots) {
    if (!packageRoot.isDirectory()) continue;
    const modules = join(bunStore, packageRoot.name, "node_modules");
    let scopes: import("node:fs").Dirent[];
    try {
      scopes = await readdir(modules, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of scopes) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("@")) {
        const scopedRoot = join(modules, entry.name);
        for (const scoped of await readdir(scopedRoot, {
          withFileTypes: true,
        })) {
          if (scoped.isDirectory()) {
            packageJsons.push(join(scopedRoot, scoped.name, "package.json"));
          }
        }
      } else {
        packageJsons.push(join(modules, entry.name, "package.json"));
      }
    }
  }
  return packageJsons;
}

async function licenseOverrides(root: string) {
  const source = JSON.parse(
    await readFile(join(root, "DEPENDENCY-LICENSE-OVERRIDES.json"), "utf8"),
  ) as {
    schema?: unknown;
    packages?: unknown;
  };
  if (
    source.schema !== "konsensus.dependency-license-overrides" ||
    !Array.isArray(source.packages)
  ) {
    throw new Error("Invalid dependency-license override manifest");
  }
  const overrides = new Map<string, LicenseOverride>();
  for (const candidate of source.packages) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      !("name" in candidate) ||
      typeof candidate.name !== "string" ||
      !("version" in candidate) ||
      typeof candidate.version !== "string" ||
      !("license" in candidate) ||
      typeof candidate.license !== "string" ||
      !("licenseFile" in candidate) ||
      typeof candidate.licenseFile !== "string" ||
      !/^[A-Za-z0-9._-]+$/.test(candidate.licenseFile) ||
      !("licenseFileSha256" in candidate) ||
      typeof candidate.licenseFileSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(candidate.licenseFileSha256)
    ) {
      throw new Error("Invalid dependency-license override entry");
    }
    const override = candidate as LicenseOverride;
    const key = `${override.name}\0${override.version}`;
    if (overrides.has(key)) {
      throw new Error(`Duplicate dependency-license override: ${key}`);
    }
    overrides.set(key, override);
  }
  return overrides;
}

export async function installedLockedPackages(root: string) {
  const lock = await readFile(join(root, "bun.lock"), "utf8");
  const locked = new Set(
    lockedPackagesFromBunLock(lock).map(
      ({ name, version }) => `${name}\0${version}`,
    ),
  );
  const overrides = await licenseOverrides(root);
  const installed = new Map<string, InstalledPackage>();
  for (const path of await packageJsonPaths(root)) {
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(await readFile(path, "utf8"));
    } catch {
      continue;
    }
    if (
      typeof manifest.name !== "string" ||
      typeof manifest.version !== "string"
    )
      continue;
    const key = `${manifest.name}\0${manifest.version}`;
    if (!locked.has(key)) continue;
    let license = normalizedLicense(manifest.license ?? manifest.licenses);
    if (license === "UNKNOWN") {
      const override = overrides.get(key);
      if (override) {
        const licensePath = join(dirname(path), override.licenseFile);
        const digest = createHash("sha256")
          .update(await readFile(licensePath))
          .digest("hex");
        if (digest !== override.licenseFileSha256) {
          throw new Error(
            `Dependency license file does not match its reviewed hash: ${manifest.name}@${manifest.version}`,
          );
        }
        license = override.license;
      }
    }
    installed.set(key, {
      name: manifest.name,
      version: manifest.version,
      license,
      path: relative(root, path).split(sep).join("/"),
    });
  }
  return [...installed.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.version.localeCompare(right.version),
  );
}

export async function verifyDependencyLicenses(root: string) {
  const installed = await installedLockedPackages(root);
  if (installed.length === 0) {
    throw new Error(
      "Dependency-license audit found no installed packages from bun.lock; run a frozen install first",
    );
  }

  const unknown = installed.filter(({ license }) => license === "UNKNOWN");
  if (unknown.length > 0) {
    const summary = unknown
      .map(({ name, version }) => `${name}@${version}`)
      .join("\n");
    throw new Error(
      `Dependency license metadata is missing and has no reviewed override:\n${summary}`,
    );
  }

  const forbidden = installed
    .map((entry) => ({
      ...entry,
      reason: forbiddenLicenseReason(entry.license),
    }))
    .filter(
      (
        entry,
      ): entry is InstalledPackage & {
        reason: string;
      } => entry.reason !== null,
    );
  if (forbidden.length > 0) {
    const summary = forbidden
      .map(({ name, version, license }) => `${name}@${version}: ${license}`)
      .join("\n");
    throw new Error(
      `Strong-copyleft or source-available dependency license detected:\n${summary}`,
    );
  }
  return {
    audited: installed.length,
    unknown: 0,
  };
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..", "..");
  const result = await verifyDependencyLicenses(root);
  console.log(
    `Dependency-license audit passed for ${result.audited} locked packages (${result.unknown} without package.json license metadata).`,
  );
}
