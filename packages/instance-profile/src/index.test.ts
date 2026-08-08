import { describe, expect, test } from "bun:test";
import { conformanceDemoProfile } from "../../../instances/conformance-demo/src";
import {
  INSTANCE_PROFILE_SCHEMA_V3,
  defineInstanceProfile,
  instanceProfileSha256,
} from "./index";

describe("instance profiles", () => {
  test("freezes and hashes the synthetic current-protocol profile", async () => {
    expect(Object.isFrozen(conformanceDemoProfile)).toBe(true);
    expect(conformanceDemoProfile.schema).toBe(INSTANCE_PROFILE_SCHEMA_V3);
    expect(conformanceDemoProfile.version).toBe("3.0.0");
    expect(conformanceDemoProfile.jurisdiction.countryCode).toBe("NZ");
    expect(conformanceDemoProfile.locales.supported).toEqual([
      "en-NZ",
      "mi-NZ",
    ]);
    expect(conformanceDemoProfile.opinionIndex.groups).toEqual([
      { id: "qualified-person", weight: "1/1" },
    ]);
    expect(conformanceDemoProfile.features.sourcedOpinions).toBe(false);
    expect(await instanceProfileSha256(conformanceDemoProfile)).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });

  test("rejects ambiguous weights and missing default locales", () => {
    expect(() =>
      defineInstanceProfile({
        ...conformanceDemoProfile,
        schema: INSTANCE_PROFILE_SCHEMA_V3,
        locales: { default: "fr", supported: ["en"] },
        opinionIndex: {
          ...conformanceDemoProfile.opinionIndex,
          groups: [{ id: "person", weight: "0.1" as "1/1" }],
        },
      }),
    ).toThrow("Invalid instance profile");
  });
});
