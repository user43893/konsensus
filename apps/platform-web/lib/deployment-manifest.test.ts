import { describe, expect, test } from "bun:test";
import { conformanceDemoProfile } from "@konsensus/instance-conformance-demo";
import { instanceProfileSha256 } from "@konsensus/instance-profile";
import {
  FRONTEND_DEPLOYMENT_MANIFEST_SCHEMA_V3,
  buildFrontendDeploymentManifest,
} from "./deployment-manifest";
import { resolveFrontendSourceBinding } from "./source-binding";

describe("frontend deployment manifest", () => {
  test("binds the visible deployment to its exact instance and API boundary", async () => {
    const manifest = await buildFrontendDeploymentManifest({
      profile: conformanceDemoProfile,
      publicApiOrigin: "https://api.example.test/api",
      relyingApplicationOrigin: "https://participate.example.test",
      sourceBinding: resolveFrontendSourceBinding({}),
    });

    expect(manifest.schema).toBe(FRONTEND_DEPLOYMENT_MANIFEST_SCHEMA_V3);
    expect(manifest.instance.id).toBe(conformanceDemoProfile.id);
    expect(manifest.instance.version).toBe(conformanceDemoProfile.version);
    expect(manifest.instance.profileDigest.value).toBe(
      await instanceProfileSha256(conformanceDemoProfile),
    );
    expect(manifest.publicApi).toEqual({
      origin: "https://api.example.test/api",
      pathStyle: "unversioned-current",
      credentials: "omit",
      mode: "external",
    });
    expect(manifest.relyingApplication).toEqual({
      status: "configured",
      origin: "https://participate.example.test",
      mutationHandling: "redirect",
    });
    expect(manifest.limitation).toContain("not independent proof");
  });

  test("reports the bundled read-only boundary without inventing a relying app", async () => {
    const manifest = await buildFrontendDeploymentManifest({
      profile: conformanceDemoProfile,
      publicApiOrigin: "/api",
      relyingApplicationOrigin: null,
      sourceBinding: resolveFrontendSourceBinding({}),
    });

    expect(manifest.publicApi.mode).toBe("bundled-reference");
    expect(manifest.relyingApplication).toEqual({
      status: "not-configured",
      origin: null,
      mutationHandling: "disabled",
    });
    expect(manifest.sourceBinding.status).toBe("unbound");
  });
});
