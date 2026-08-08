import type { InstanceProfileV3 } from "@konsensus/instance-profile";

export type PlatformRoute =
  | { kind: "home" }
  | { kind: "issues" }
  | { kind: "issue"; slug: string }
  | { kind: "methodology" }
  | { kind: "verification" }
  | { kind: "voter"; publicVoterId: string }
  | { kind: "voters" }
  | { kind: "vote"; slug: string }
  | { kind: "not-found" };

export function matchPlatformRoute(
  profile: InstanceProfileV3,
  segments: readonly string[],
): PlatformRoute {
  if (segments.length === 0) return { kind: "home" };

  const staticRoutes = [
    ["issues", profile.routes.issues],
    ["methodology", profile.routes.methodology],
    ["verification", profile.routes.verification],
  ] as const;
  for (const [kind, template] of staticRoutes) {
    if (template && routeMatches(template, segments)) return { kind };
  }

  if (
    profile.features.publicVoterPages &&
    profile.routes.voters &&
    routeMatches(profile.routes.voters, segments)
  ) {
    return { kind: "voters" };
  }

  if (profile.features.publicVoterPages && profile.routes.voter) {
    const voter = matchTemplate(profile.routes.voter, segments);
    if (voter?.publicVoterId) {
      return { kind: "voter", publicVoterId: voter.publicVoterId };
    }
  }

  const vote = matchTemplate(profile.routes.vote, segments);
  if (vote?.slug) return { kind: "vote", slug: vote.slug };

  const issue = matchTemplate(profile.routes.issue, segments);
  if (issue?.slug) return { kind: "issue", slug: issue.slug };

  return { kind: "not-found" };
}

export function interpolateRoute(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{([a-z][a-z0-9]*)\}/gi, (_match, name: string) => {
    const value = values[name];
    if (!value) {
      throw new TypeError(`Missing route value: ${name}`);
    }
    return encodeURIComponent(value);
  });
}

export function selectLocale<Locale extends string>(
  profile: InstanceProfileV3<Locale>,
  candidate: string | undefined,
): Locale {
  return candidate && profile.locales.supported.includes(candidate as Locale)
    ? (candidate as Locale)
    : profile.locales.default;
}

export function withLocale(
  path: string,
  locale: string,
  defaultLocale: string,
): string {
  if (locale === defaultLocale) return path;
  const url = new URL(path, "https://platform.invalid");
  url.searchParams.set("lang", locale);
  return `${url.pathname}${url.search}`;
}

export function publicApiResourceUrl(
  publicApiOrigin: string,
  kind: "verification" | "vote",
  id: string,
): string {
  const resource =
    kind === "verification" ? "verification-proofs" : "vote-proofs";
  return `${publicApiOrigin.replace(/\/+$/, "")}/${resource}/${encodeURIComponent(id)}`;
}

export function relyingApplicationUrl(origin: string, path: string): string {
  const url = new URL(path, `${origin}/`);
  if (url.origin !== origin) {
    throw new TypeError(
      "Relying-application route escaped its configured origin",
    );
  }
  return url.toString();
}

function routeMatches(template: string, segments: readonly string[]) {
  return matchTemplate(template, segments) !== null;
}

function matchTemplate(
  template: string | undefined,
  segments: readonly string[],
): Record<string, string> | null {
  if (!template) return null;
  const expected = template.split("/").filter(Boolean);
  if (expected.length !== segments.length) return null;

  const values: Record<string, string> = {};
  for (let index = 0; index < expected.length; index += 1) {
    const part = expected[index];
    const actual = segments[index];
    const parameter = /^\{([a-z][a-z0-9]*)\}$/i.exec(part);
    if (parameter) {
      if (!actual) return null;
      values[parameter[1]] = actual;
    } else if (part !== actual) {
      return null;
    }
  }
  return values;
}
