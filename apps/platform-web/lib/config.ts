import type { InstanceProfileV3 } from "@konsensus/instance-profile";

export const PLATFORM_DEPLOYMENT_SETTINGS_SCHEMA_V3 =
  "qualified-opinion.frontend-deployment-settings.v3" as const;

export type PlatformDeploymentSettings = Readonly<{
  publicApiOrigin: string;
  relyingApplicationOrigin: string | null;
}>;

export type EmbeddedPlatformDeploymentSettings = Readonly<{
  schema: typeof PLATFORM_DEPLOYMENT_SETTINGS_SCHEMA_V3;
  publicApiOrigin: string;
  relyingApplicationOrigin: string | null;
}>;

export type PlatformMessages = {
  allIssues: string;
  apiUnavailable: string;
  backToIssues: string;
  contact: string;
  decisions: string;
  eligibilityDirectory: string;
  eligibilityDirectoryBody: string;
  eligibleSince: string;
  events: string;
  featuredIssues: string;
  featuredProofs: string;
  heroAction: string;
  heroEyebrow: string;
  issueNotFound: string;
  jurisdiction: string;
  loading: string;
  methodology: string;
  methodologyBody: string;
  methodologyTitle: string;
  noIssues: string;
  noEligibleParticipants: string;
  openParticipant: string;
  openIssue: string;
  proofBody: string;
  proofUnavailable: string;
  proceedings: string;
  questions: string;
  readOnlyNotice: string;
  registryEmail: string;
  respond: string;
  responses: string;
  sources: string;
  technicalRecord: string;
  verification: string;
  verificationTitle: string;
  viewRawProof: string;
  backToDirectory: string;
};

export type PlatformTheme = {
  accent: string;
  accentStrong: string;
  canvas: string;
  ink: string;
  muted: string;
  panel: string;
  mark: string;
};

export type FeaturedProof<Locale extends string> = {
  kind: "verification" | "vote";
  id: string;
  labels: Readonly<Record<Locale, string>>;
};

export type PlatformFrontendConfig<Locale extends string = string> = {
  profile: InstanceProfileV3<Locale>;
  publicApiOrigin: string;
  relyingApplicationOrigin: string | null;
  theme: PlatformTheme;
  messages: Readonly<Record<Locale, PlatformMessages>>;
  featuredProofs: readonly FeaturedProof<Locale>[];
};

export type DeploymentEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function resolveDeploymentSettings(
  environment: DeploymentEnvironment,
): PlatformDeploymentSettings {
  const publicApiOrigin = normalizePublicApiOrigin(
    environment.KONSENSUS_PUBLIC_API_ORIGIN ?? "/api",
  );
  const relyingApplicationOrigin = normalizeRelyingApplicationOrigin(
    environment.KONSENSUS_RELYING_APP_ORIGIN,
  );
  return Object.freeze({ publicApiOrigin, relyingApplicationOrigin });
}

export function createEmbeddedDeploymentSettings(
  settings: PlatformDeploymentSettings,
): EmbeddedPlatformDeploymentSettings {
  return Object.freeze({
    schema: PLATFORM_DEPLOYMENT_SETTINGS_SCHEMA_V3,
    publicApiOrigin: normalizePublicApiOrigin(settings.publicApiOrigin),
    relyingApplicationOrigin: normalizeRelyingApplicationOrigin(
      settings.relyingApplicationOrigin ?? undefined,
    ),
  });
}

export function parseEmbeddedDeploymentSettings(
  serialized: string,
): PlatformDeploymentSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new TypeError("Embedded deployment settings are not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new TypeError("Embedded deployment settings must be an object");
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    candidate.schema !== PLATFORM_DEPLOYMENT_SETTINGS_SCHEMA_V3 ||
    typeof candidate.publicApiOrigin !== "string" ||
    (candidate.relyingApplicationOrigin !== null &&
      typeof candidate.relyingApplicationOrigin !== "string")
  ) {
    throw new TypeError("Embedded deployment settings have an invalid schema");
  }

  const settings = resolveDeploymentSettings({
    KONSENSUS_PUBLIC_API_ORIGIN: candidate.publicApiOrigin,
    KONSENSUS_RELYING_APP_ORIGIN:
      candidate.relyingApplicationOrigin ?? undefined,
  });
  if (
    settings.publicApiOrigin !== candidate.publicApiOrigin ||
    settings.relyingApplicationOrigin !== candidate.relyingApplicationOrigin
  ) {
    throw new TypeError("Embedded deployment settings are not canonical");
  }
  return settings;
}

export function deploymentSettingsForRuntime(
  environment: DeploymentEnvironment,
): PlatformDeploymentSettings {
  const embedded = environment.KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS;
  if (!embedded) {
    if (environment.NODE_ENV === "production") {
      throw new TypeError(
        "Production frontend runtime is missing build-embedded deployment settings",
      );
    }
    return resolveDeploymentSettings(environment);
  }

  const settings = parseEmbeddedDeploymentSettings(embedded);
  const apiOverride = environment.KONSENSUS_PUBLIC_API_ORIGIN;
  if (
    apiOverride !== undefined &&
    normalizePublicApiOrigin(apiOverride) !== settings.publicApiOrigin
  ) {
    throw new TypeError(
      "Runtime KONSENSUS_PUBLIC_API_ORIGIN does not match the build-embedded value",
    );
  }
  const relyingOverride = environment.KONSENSUS_RELYING_APP_ORIGIN;
  if (
    relyingOverride !== undefined &&
    normalizeRelyingApplicationOrigin(relyingOverride) !==
      settings.relyingApplicationOrigin
  ) {
    throw new TypeError(
      "Runtime KONSENSUS_RELYING_APP_ORIGIN does not match the build-embedded value",
    );
  }
  return settings;
}

export function definePlatformFrontendConfig<const Locale extends string>(
  config: PlatformFrontendConfig<Locale>,
): Readonly<PlatformFrontendConfig<Locale>> {
  const errors: string[] = [];
  const requiredRoutes = [
    "issue",
    "issues",
    "methodology",
    "verification",
    "vote",
  ] as const;

  for (const route of requiredRoutes) {
    if (!config.profile.routes[route]) {
      errors.push(`profile.routes.${route} is required`);
    }
  }
  if (
    config.profile.routes.issue &&
    !config.profile.routes.issue.includes("{slug}")
  ) {
    errors.push("profile.routes.issue must contain {slug}");
  }
  if (
    config.profile.routes.vote &&
    !config.profile.routes.vote.includes("{slug}")
  ) {
    errors.push("profile.routes.vote must contain {slug}");
  }
  if (config.profile.features.publicVoterPages) {
    if (!config.profile.routes.voters) {
      errors.push("profile.routes.voters is required for public voter pages");
    }
    if (!config.profile.routes.voter?.includes("{publicVoterId}")) {
      errors.push(
        "profile.routes.voter must contain {publicVoterId} for public voter pages",
      );
    }
  }

  const supportedLocales = new Set(config.profile.locales.supported);
  for (const locale of supportedLocales) {
    if (!config.messages[locale]) {
      errors.push(`messages are missing for ${locale}`);
    }
  }
  for (const locale of Object.keys(config.messages)) {
    if (!supportedLocales.has(locale as Locale)) {
      errors.push(`messages include unsupported locale ${locale}`);
    }
  }

  for (const [name, value] of Object.entries(config.theme)) {
    if (name === "mark") {
      if (!/^[\p{L}\p{N}]{1,4}$/u.test(value)) {
        errors.push("theme.mark must contain one to four letters or numbers");
      }
    } else if (!/^#[0-9a-f]{6}$/i.test(value)) {
      errors.push(`theme.${name} must be a six-digit hexadecimal colour`);
    }
  }

  const proofKeys = new Set<string>();
  for (const proof of config.featuredProofs) {
    if (!/^[A-Za-z0-9._~-]+$/.test(proof.id)) {
      errors.push(
        `featured proof ID is not one safe path segment: ${proof.id}`,
      );
    }
    const key = `${proof.kind}:${proof.id}`;
    if (proofKeys.has(key)) {
      errors.push(`featured proof is duplicated: ${key}`);
    }
    proofKeys.add(key);
    for (const locale of supportedLocales) {
      if (!proof.labels[locale]?.trim()) {
        errors.push(`featured proof ${key} has no label for ${locale}`);
      }
    }
  }

  try {
    normalizePublicApiOrigin(config.publicApiOrigin);
  } catch (error) {
    errors.push((error as Error).message);
  }
  try {
    normalizeRelyingApplicationOrigin(
      config.relyingApplicationOrigin ?? undefined,
    );
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (errors.length > 0) {
    throw new TypeError(
      `Invalid platform frontend configuration:\n- ${errors.join("\n- ")}`,
    );
  }
  return Object.freeze(config);
}

export function normalizePublicApiOrigin(value: string): string {
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    const parsed = new URL(candidate, "https://platform.invalid");
    assertCurrentApiPath(parsed);
    if (
      parsed.search ||
      parsed.hash ||
      parsed.origin !== "https://platform.invalid"
    ) {
      throw new TypeError(
        "KONSENSUS_PUBLIC_API_ORIGIN must not include a query or fragment",
      );
    }
    return parsed.pathname.replace(/\/+$/, "");
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TypeError(
      "KONSENSUS_PUBLIC_API_ORIGIN must be an absolute HTTPS URL or an absolute path",
    );
  }
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && isLoopback(parsed.hostname))
  ) {
    throw new TypeError(
      "KONSENSUS_PUBLIC_API_ORIGIN must use HTTPS outside local development",
    );
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError(
      "KONSENSUS_PUBLIC_API_ORIGIN must not include credentials, a query, or a fragment",
    );
  }
  assertCurrentApiPath(parsed);
  return parsed.toString().replace(/\/+$/, "");
}

export function normalizeRelyingApplicationOrigin(
  value: string | undefined,
): string | null {
  if (value === undefined || value.trim() === "") return null;

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new TypeError("KONSENSUS_RELYING_APP_ORIGIN must be an absolute URL");
  }
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && isLoopback(parsed.hostname))
  ) {
    throw new TypeError(
      "KONSENSUS_RELYING_APP_ORIGIN must use HTTPS outside local development",
    );
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new TypeError(
      "KONSENSUS_RELYING_APP_ORIGIN must be an origin without credentials, path, query, or fragment",
    );
  }
  return parsed.origin;
}

function assertCurrentApiPath(url: URL) {
  if (!url.pathname.replace(/\/+$/, "").endsWith("/api")) {
    throw new TypeError(
      "KONSENSUS_PUBLIC_API_ORIGIN must end with the unversioned /api path",
    );
  }
}

function isLoopback(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}
