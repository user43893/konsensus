import { describe, expect, test } from "bun:test";
import { conformanceDemoProfile } from "@konsensus/instance-conformance-demo";
import {
  interpolateRoute,
  matchPlatformRoute,
  publicApiResourceUrl,
  relyingApplicationUrl,
  selectLocale,
  withLocale,
} from "./routes";

describe("profile-driven platform routes", () => {
  test("matches the instance's static and parameterized routes", () => {
    expect(matchPlatformRoute(conformanceDemoProfile, [])).toEqual({
      kind: "home",
    });
    expect(matchPlatformRoute(conformanceDemoProfile, ["questions"])).toEqual({
      kind: "issues",
    });
    expect(
      matchPlatformRoute(conformanceDemoProfile, [
        "questions",
        "coastal-access",
      ]),
    ).toEqual({ kind: "issue", slug: "coastal-access" });
    expect(
      matchPlatformRoute(conformanceDemoProfile, [
        "questions",
        "coastal-access",
        "respond",
      ]),
    ).toEqual({ kind: "vote", slug: "coastal-access" });
    expect(
      matchPlatformRoute(conformanceDemoProfile, ["participants"]),
    ).toEqual({
      kind: "voters",
    });
    expect(
      matchPlatformRoute(conformanceDemoProfile, [
        "participants",
        "participant-1",
      ]),
    ).toEqual({ kind: "voter", publicVoterId: "participant-1" });
  });

  test("encodes instance slugs and proof IDs as one path segment", () => {
    expect(interpolateRoute("/questions/{slug}", { slug: "../private" })).toBe(
      "/questions/..%2Fprivate",
    );
    expect(publicApiResourceUrl("/api", "vote", "../private")).toBe(
      "/api/vote-proofs/..%2Fprivate",
    );
  });

  test("selects only supported locales and preserves non-default choices", () => {
    expect(selectLocale(conformanceDemoProfile, "mi-NZ")).toBe("mi-NZ");
    expect(selectLocale(conformanceDemoProfile, "fr")).toBe("en-NZ");
    expect(withLocale("/questions", "mi-NZ", "en-NZ")).toBe(
      "/questions?lang=mi-NZ",
    );
    expect(withLocale("/questions", "en-NZ", "en-NZ")).toBe("/questions");
  });

  test("keeps mutation redirects on the configured relying origin", () => {
    expect(
      relyingApplicationUrl(
        "https://participate.example.test",
        "/questions/coastal-access/respond",
      ),
    ).toBe("https://participate.example.test/questions/coastal-access/respond");
  });
});
