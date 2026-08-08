import { describe, expect, test } from "bun:test";
import {
  questionVoteLogIdV3,
  verifyActiveEligibilityDirectoryBundleIntegrityV3,
  verifyActiveEligibilityDirectoryRecordProofIntegrityV3,
} from "@konsensus/proof";
import { PublicApiClient } from "@konsensus/public-api";
import { GET as getDeploymentManifest } from "../app/.well-known/deployment.json/route";
import { GET as getSourceBinding } from "../app/.well-known/source.json/route";
import { GET as getEligibilityDirectoryRecord } from "../app/api/eligibility-directory/[publicVoterId]/route";
import { GET as getEligibilityDirectoryCheckpoints } from "../app/api/eligibility-directory/checkpoints/route";
import { GET as getEligibilityDirectory } from "../app/api/eligibility-directory/route";
import { GET as getIssues } from "../app/api/issues/route";
import { GET as getQuestionVoteCheckpoint } from "../app/api/questions/[id]/vote-checkpoint/route";
import {
  createEmbeddedDeploymentSettings,
  resolveDeploymentSettings,
} from "../lib/config";
import { bundledDemoApiEnabled, demoApiOptions } from "../lib/demo-api";

describe("bundled reference API", () => {
  test("serves the current unversioned API to the credential-free client", async () => {
    const client = new PublicApiClient({
      baseUrl: "https://demo.example.test/api",
      fetch: async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/api/issues") {
          return getIssues(new Request(url));
        }
        return Response.json({ error: "not_found" }, { status: 404 });
      },
    });

    const { issues } = await client.listIssues({
      q: "coastal",
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.slug).toBe("coastal-access");
  });

  test("matches the current non-paginated issue collection shape", async () => {
    const response = await getIssues(
      new Request("https://demo.example.test/api/issues"),
    );
    const body = (await response.json()) as {
      issues: { slug: string }[];
    };
    expect(response.status).toBe(200);
    expect(body.issues).toHaveLength(2);
    expect(body).not.toHaveProperty("pagination");
  });

  test("serves the complete current eligibility set and deterministic question log", async () => {
    const client = new PublicApiClient({
      baseUrl: "https://demo.example.test/api",
      fetch: async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/api/eligibility-directory") {
          return getEligibilityDirectory();
        }
        if (url.pathname === "/api/eligibility-directory/checkpoints") {
          return getEligibilityDirectoryCheckpoints(new Request(url));
        }
        if (url.pathname.startsWith("/api/eligibility-directory/")) {
          return getEligibilityDirectoryRecord(new Request(url), {
            params: Promise.resolve({
              publicVoterId: decodeURIComponent(
                url.pathname.split("/").at(-1) ?? "",
              ),
            }),
          });
        }
        if (url.pathname.endsWith("/vote-checkpoint")) {
          return getQuestionVoteCheckpoint(new Request(url), {
            params: Promise.resolve({ id: "question-coastal-access" }),
          });
        }
        return Response.json({ error: "not_found" }, { status: 404 });
      },
    });

    const directory = await client.getEligibilityDirectory();
    expect(directory.records).toHaveLength(1);
    expect(
      (await verifyActiveEligibilityDirectoryBundleIntegrityV3(directory)).ok,
    ).toBe(true);

    const publicVoterId = directory.records[0]?.publicVoterId ?? "";
    const record = await client.getEligibilityDirectoryRecord(publicVoterId);
    expect(
      (await verifyActiveEligibilityDirectoryRecordProofIntegrityV3(record)).ok,
    ).toBe(true);

    const history = await client.getEligibilityDirectoryCheckpoints();
    expect(history.checkpoints).toEqual([directory.checkpoint]);

    const questionCheckpoint = await client.getQuestionVoteCheckpoint(
      "question-coastal-access",
    );
    const checkpoint = questionCheckpoint.checkpoint as {
      payload: { logId: string };
    };
    expect(checkpoint.payload.logId).toBe(
      await questionVoteLogIdV3({
        instanceId: directory.checkpoint.payload.instanceId,
        questionId: "question-coastal-access",
      }),
    );
  });

  test("advertises anonymous cross-origin reads", () => {
    const response = demoApiOptions();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  test("disables synthetic endpoints when an external API is selected", () => {
    const external = JSON.stringify(
      createEmbeddedDeploymentSettings(
        resolveDeploymentSettings({
          KONSENSUS_PUBLIC_API_ORIGIN: "https://public.example.test/api",
        }),
      ),
    );
    expect(
      bundledDemoApiEnabled({
        KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS: external,
      }),
    ).toBe(false);
    expect(bundledDemoApiEnabled({ KONSENSUS_PUBLIC_API_ORIGIN: "/api" })).toBe(
      true,
    );
  });

  test("publishes an explicit unbound status in zero-config demo mode", async () => {
    const response = getSourceBinding();
    const body = (await response.json()) as {
      status: string;
      repositoryUrl: string | null;
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(body.status).toBe("unbound");
    expect(body.repositoryUrl).toBeNull();
  });

  test("publishes the exact non-secret API and profile boundary", async () => {
    const response = await getDeploymentManifest();
    const body = (await response.json()) as {
      instance: { id: string; profileDigest: { value: string } };
      publicApi: {
        origin: string;
        pathStyle: string;
        credentials: string;
        mode: string;
      };
      relyingApplication: {
        status: string;
        origin: string | null;
        mutationHandling: string;
      };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(body.instance.id).toBe("example.nz.open-law");
    expect(body.instance.profileDigest.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.publicApi).toEqual({
      origin: "/api",
      pathStyle: "unversioned-current",
      credentials: "omit",
      mode: "bundled-reference",
    });
    expect(body.relyingApplication).toEqual({
      status: "not-configured",
      origin: null,
      mutationHandling: "disabled",
    });
  });
});
