import { describe, expect, test } from "bun:test";
import {
  FRONTEND_SOURCE_BINDING_SCHEMA_V3,
  SOURCE_INVENTORY_FORMAT,
  type VerifiedSourceCheckout,
  parseEmbeddedFrontendSourceBinding,
  resolveFrontendSourceBinding,
} from "./source-binding";

const sourceCommit = "0123456789abcdef0123456789abcdef01234567";
const boundEnvironment = {
  KONSENSUS_REQUIRE_SOURCE_BINDING: "true",
  KONSENSUS_PUBLIC_REPOSITORY_URL:
    "https://code.example.test/qualified-opinion/frontend",
  KONSENSUS_RELEASE_SOURCE_SHA: sourceCommit,
  KONSENSUS_RELEASE_BUILD_ID: "release-2026.07.23",
} as const;
const checkout: VerifiedSourceCheckout = {
  headCommit: sourceCommit,
  sourceInventory: {
    algorithm: "sha-256",
    encoding: "hex",
    format: SOURCE_INVENTORY_FORMAT,
    trackedFiles: 42,
    value: "a".repeat(64),
  },
};

describe("frontend source binding", () => {
  test("binds an official build to the inspected checkout and inventory", () => {
    expect(
      resolveFrontendSourceBinding(boundEnvironment, () => checkout),
    ).toEqual({
      schema: FRONTEND_SOURCE_BINDING_SCHEMA_V3,
      status: "bound",
      repositoryUrl: "https://code.example.test/qualified-opinion/frontend",
      sourceCommit,
      buildId: "release-2026.07.23",
      sourceInventory: checkout.sourceInventory,
      provenance: {
        status: "not-attested",
        limitation: expect.stringContaining("hosting provider"),
      },
    });
  });

  test("reports an honest unbound state for the zero-config demo", () => {
    const binding = resolveFrontendSourceBinding({});
    expect(binding.status).toBe("unbound");
    expect(binding.repositoryUrl).toBeNull();
    expect(binding.sourceCommit).toBeNull();
    expect(binding.buildId).toBeNull();
    expect(binding.sourceInventory).toBeNull();
    expect(binding.provenance.status).toBe("not-attested");
  });

  test("fails closed without checkout inspection or on a HEAD mismatch", () => {
    expect(() => resolveFrontendSourceBinding(boundEnvironment)).toThrow(
      "requires inspection",
    );
    expect(() =>
      resolveFrontendSourceBinding(boundEnvironment, () => ({
        ...checkout,
        headCommit: "f".repeat(40),
      })),
    ).toThrow("does not match");
  });

  test("fails closed for official, partial, or malformed bindings", () => {
    expect(() =>
      resolveFrontendSourceBinding({
        KONSENSUS_REQUIRE_SOURCE_BINDING: "true",
      }),
    ).toThrow("Official frontend builds require");
    expect(() =>
      resolveFrontendSourceBinding({
        KONSENSUS_PUBLIC_REPOSITORY_URL:
          "https://code.example.test/project/frontend",
      }),
    ).toThrow("Source binding is partial");
    expect(() =>
      resolveFrontendSourceBinding(
        {
          ...boundEnvironment,
          KONSENSUS_RELEASE_SOURCE_SHA: "not-a-commit",
        },
        () => checkout,
      ),
    ).toThrow("exact lowercase 40-hex");
    expect(() =>
      resolveFrontendSourceBinding(
        {
          ...boundEnvironment,
          KONSENSUS_PUBLIC_REPOSITORY_URL: "http://code.example.test/project",
        },
        () => checkout,
      ),
    ).toThrow("credential-free HTTPS");
  });

  test("revalidates the binding embedded into the built server", () => {
    const binding = resolveFrontendSourceBinding(
      boundEnvironment,
      () => checkout,
    );
    expect(
      parseEmbeddedFrontendSourceBinding(JSON.stringify(binding), true),
    ).toEqual(binding);
    expect(() =>
      parseEmbeddedFrontendSourceBinding(
        JSON.stringify(resolveFrontendSourceBinding({})),
        true,
      ),
    ).toThrow("unexpectedly unbound");
  });
});
