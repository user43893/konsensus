import { describe, expect, test } from "bun:test";
import {
  conformanceDemoFrontend,
  conformanceDemoProfile,
} from "@konsensus/instance-conformance-demo";
import {
  createEmbeddedDeploymentSettings,
  definePlatformFrontendConfig,
  deploymentSettingsForRuntime,
  normalizePublicApiOrigin,
  normalizeRelyingApplicationOrigin,
  parseEmbeddedDeploymentSettings,
  resolveDeploymentSettings,
} from "./config";

describe("platform deployment configuration", () => {
  test("accepts a relative bundled API or a secure external current API", () => {
    expect(resolveDeploymentSettings({})).toEqual({
      publicApiOrigin: "/api",
      relyingApplicationOrigin: null,
    });
    expect(normalizePublicApiOrigin("https://public.example.test/api/")).toBe(
      "https://public.example.test/api",
    );
    expect(normalizePublicApiOrigin("http://localhost:3001/api")).toBe(
      "http://localhost:3001/api",
    );
  });

  test("rejects insecure remote APIs and ambiguous relying-app URLs", () => {
    expect(() =>
      normalizePublicApiOrigin("http://public.example.test/api"),
    ).toThrow("must use HTTPS");
    expect(() =>
      normalizePublicApiOrigin(
        `https://public.example.test/api/${["v", "2"].join("")}`,
      ),
    ).toThrow("unversioned");
    expect(() =>
      normalizeRelyingApplicationOrigin(
        "https://participate.example.test/untrusted/path",
      ),
    ).toThrow("must be an origin");
  });

  test("uses one canonical build embedding and rejects runtime divergence", () => {
    const settings = resolveDeploymentSettings({
      KONSENSUS_PUBLIC_API_ORIGIN: "https://api.example.test/api/",
      KONSENSUS_RELYING_APP_ORIGIN: "https://participate.example.test/",
    });
    const embedded = JSON.stringify(createEmbeddedDeploymentSettings(settings));

    expect(parseEmbeddedDeploymentSettings(embedded)).toEqual(settings);
    expect(
      deploymentSettingsForRuntime({
        NODE_ENV: "production",
        KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS: embedded,
      }),
    ).toEqual(settings);
    expect(() =>
      deploymentSettingsForRuntime({
        NODE_ENV: "production",
        KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS: embedded,
        KONSENSUS_PUBLIC_API_ORIGIN: "https://other.example.test/api",
      }),
    ).toThrow("does not match the build-embedded value");
    expect(() =>
      deploymentSettingsForRuntime({
        NODE_ENV: "production",
        KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS: embedded,
        KONSENSUS_PUBLIC_API_ORIGIN: "",
      }),
    ).toThrow("must be an absolute HTTPS URL");
    expect(() =>
      deploymentSettingsForRuntime({ NODE_ENV: "production" }),
    ).toThrow("missing build-embedded");
  });

  test("requires localized presentation for every profile locale", () => {
    expect(() =>
      definePlatformFrontendConfig({
        profile: conformanceDemoProfile,
        publicApiOrigin: "/api",
        relyingApplicationOrigin: null,
        theme: conformanceDemoFrontend.theme,
        messages: {
          "en-NZ": conformanceDemoFrontend.messages["en-NZ"],
        } as typeof conformanceDemoFrontend.messages,
        featuredProofs: conformanceDemoFrontend.featuredProofs,
      }),
    ).toThrow("messages are missing for mi-NZ");
  });

  test("requires every frontend route from the current profile", () => {
    const profileWithoutVerification = {
      ...conformanceDemoProfile,
      routes: {
        ...conformanceDemoProfile.routes,
        verification: "",
      },
    };
    expect(() =>
      definePlatformFrontendConfig({
        profile:
          profileWithoutVerification as unknown as typeof conformanceDemoProfile,
        publicApiOrigin: "/api",
        relyingApplicationOrigin: null,
        ...conformanceDemoFrontend,
      }),
    ).toThrow("profile.routes.verification is required");
  });

  test("requires both public-participant routes when participant pages are enabled", () => {
    const profileWithoutDirectory = {
      ...conformanceDemoProfile,
      routes: {
        ...conformanceDemoProfile.routes,
        voters: "",
      },
    };
    expect(() =>
      definePlatformFrontendConfig({
        profile:
          profileWithoutDirectory as unknown as typeof conformanceDemoProfile,
        publicApiOrigin: "/api",
        relyingApplicationOrigin: null,
        ...conformanceDemoFrontend,
      }),
    ).toThrow("profile.routes.voters is required for public voter pages");

    const profileWithoutParticipantPlaceholder = {
      ...conformanceDemoProfile,
      routes: {
        ...conformanceDemoProfile.routes,
        voter: "/participants/record",
      },
    };
    expect(() =>
      definePlatformFrontendConfig({
        profile:
          profileWithoutParticipantPlaceholder as unknown as typeof conformanceDemoProfile,
        publicApiOrigin: "/api",
        relyingApplicationOrigin: null,
        ...conformanceDemoFrontend,
      }),
    ).toThrow(
      "profile.routes.voter must contain {publicVoterId} for public voter pages",
    );
  });
});
