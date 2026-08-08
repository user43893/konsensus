import { canonicalJsonSha256, canonicalizeJson } from "@konsensus/proof";

export const INSTANCE_PROFILE_SCHEMA_V3 =
  "qualified-opinion.instance-profile.v3" as const;

export type RationalWeight = `${bigint}/${bigint}`;

export type InstanceProfileV3<Locale extends string = string> = {
  schema: typeof INSTANCE_PROFILE_SCHEMA_V3;
  id: string;
  version: string;
  brand: {
    name: string;
    shortDescription: string;
    contactEmail: string;
  };
  jurisdiction: {
    countryCode: string;
    name: string;
  };
  locales: {
    default: Locale;
    supported: readonly Locale[];
  };
  routes: Readonly<Record<string, string>>;
  qualification: {
    policyId: string;
    issuer: string;
    subjectIssuer: string;
    subjectKeyScheme: string;
    publicIdentity: boolean;
    evidenceTypes: readonly string[];
  };
  opinionIndex: {
    policyId: string;
    groups: readonly {
      id: string;
      weight: RationalWeight;
    }[];
    depthThresholds: {
      main: number;
      secondary: number;
    };
    directVotePrecedence: "prefer_direct" | "separate_channels";
  };
  features: {
    directVoting: boolean;
    sourcedOpinions: boolean;
    publicVoterPages: boolean;
  };
};

export function defineInstanceProfile<
  const Locale extends string,
  const Profile extends InstanceProfileV3<Locale>,
>(profile: Profile): Readonly<Profile> {
  assertInstanceProfile(profile);
  return deepFreeze(profile);
}

export function assertInstanceProfile(
  profile: InstanceProfileV3,
): asserts profile is InstanceProfileV3 {
  const errors: string[] = [];
  if (profile.schema !== INSTANCE_PROFILE_SCHEMA_V3) {
    errors.push("schema is unsupported");
  }
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(profile.id)) {
    errors.push("id must be a stable reverse-domain identifier");
  }
  if (!/^\d+\.\d+\.\d+$/.test(profile.version)) {
    errors.push("version must be an exact semantic version");
  }
  if (!/^[A-Z]{2}$/.test(profile.jurisdiction.countryCode)) {
    errors.push("jurisdiction.countryCode must be ISO 3166-1 alpha-2");
  }
  if (
    profile.locales.supported.length === 0 ||
    new Set(profile.locales.supported).size !==
      profile.locales.supported.length ||
    !profile.locales.supported.includes(profile.locales.default)
  ) {
    errors.push("locales must be unique and include the default locale");
  }
  if (
    Object.keys(profile.routes).length === 0 ||
    Object.values(profile.routes).some(
      (route) => !route.startsWith("/") || /\s/.test(route),
    )
  ) {
    errors.push("routes must be absolute, whitespace-free paths");
  }
  if (
    profile.opinionIndex.groups.length === 0 ||
    new Set(profile.opinionIndex.groups.map((group) => group.id)).size !==
      profile.opinionIndex.groups.length ||
    profile.opinionIndex.groups.some(
      (group) => !isNonNegativeRational(group.weight),
    )
  ) {
    errors.push("opinion-index groups must have unique IDs and exact weights");
  }
  if (
    !Number.isSafeInteger(profile.opinionIndex.depthThresholds.main) ||
    profile.opinionIndex.depthThresholds.main < 0 ||
    !Number.isSafeInteger(profile.opinionIndex.depthThresholds.secondary) ||
    profile.opinionIndex.depthThresholds.secondary < 0
  ) {
    errors.push("depth thresholds must be non-negative safe integers");
  }
  if (
    !profile.brand.name.trim() ||
    !profile.brand.shortDescription.trim() ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.brand.contactEmail)
  ) {
    errors.push("brand metadata is incomplete");
  }
  if (
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(profile.qualification.issuer) ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(
      profile.qualification.subjectIssuer,
    ) ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(
      profile.qualification.subjectKeyScheme,
    )
  ) {
    errors.push("qualification issuer and subject scheme IDs are invalid");
  }
  if (errors.length > 0) {
    throw new TypeError(`Invalid instance profile:\n- ${errors.join("\n- ")}`);
  }
}

export function canonicalInstanceProfile(profile: InstanceProfileV3) {
  assertInstanceProfile(profile);
  return canonicalizeJson(profile);
}

export async function instanceProfileSha256(profile: InstanceProfileV3) {
  assertInstanceProfile(profile);
  return canonicalJsonSha256(profile);
}

function isNonNegativeRational(value: string): value is RationalWeight {
  const match = /^(0|[1-9]\d*)\/([1-9]\d*)$/.exec(value);
  return Boolean(match);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
