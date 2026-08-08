import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import publicationManifestJson from "../../PUBLICATION-HARDENING.json";
import {
  type GitHubApi,
  type GitHubResponse,
  GitHubRestApi,
  type HardeningInvocation,
  type PublicationHardeningManifest,
  applyAndRetirePublicationHardening,
  canonicalJson,
  invocationFromEnvironment,
  validatePublicationHardeningManifest,
  verifyPublicationHardeningSource,
} from "./harden-publication";

const sourceCommit = "a".repeat(40);
const manifest = validatePublicationHardeningManifest(publicationManifestJson);

function invocation(
  overrides: Partial<HardeningInvocation> = {},
): HardeningInvocation {
  return {
    actor: manifest.repository.owner,
    actorId: manifest.repository.ownerId,
    confirmation: "",
    eventName: "public",
    ref: "refs/heads/main",
    repository: `${manifest.repository.owner}/${manifest.repository.name}`,
    repositoryId: manifest.repository.repositoryId,
    repositoryOwnerId: manifest.repository.ownerId,
    repositoryVisibility: "public",
    runAttempt: 1,
    sourceCommit,
    workflowRef: `${manifest.repository.owner}/${manifest.repository.name}/.github/workflows/post-public-hardening.yml@refs/heads/main`,
    workflowSha: sourceCommit,
    ...overrides,
  };
}

function environment(
  overrides: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTOR: manifest.repository.owner,
    PUBLICATION_ACTOR_ID: String(manifest.repository.ownerId),
    GITHUB_EVENT_NAME: "public",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: `${manifest.repository.owner}/${manifest.repository.name}`,
    PUBLICATION_REPOSITORY_ID: String(manifest.repository.repositoryId),
    PUBLICATION_REPOSITORY_OWNER_ID: String(manifest.repository.ownerId),
    PUBLICATION_REPOSITORY_VISIBILITY: "public",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_SHA: sourceCommit,
    GITHUB_WORKFLOW_REF: `${manifest.repository.owner}/${manifest.repository.name}/.github/workflows/post-public-hardening.yml@refs/heads/main`,
    PUBLICATION_WORKFLOW_SHA: sourceCommit,
    PUBLICATION_HARDENING_CONFIRMATION: "",
    NODE_ENV: "test",
    ...overrides,
  };
}

function enabled(value: boolean) {
  return { enabled: value };
}

class FakeApi implements GitHubApi {
  actionsReady = false;
  automatedFixesReady = false;
  branchReady = false;
  calls: Array<{ body: unknown; method: string; path: string }> = [];
  checksReady = true;
  credentialPresent = true;
  metadataReady = false;
  privateReportingReady = false;
  protectionBody: Record<string, unknown> | null = null;
  securityReady = false;
  signaturesReady = false;
  topicsReady = false;
  topicLagReads = 0;
  vulnerabilityAlertsReady = false;
  workflowReady = false;
  breakFinalTopics = false;
  deployKeys: unknown[] = [];
  extraCollaborators: unknown[] = [];
  extraSecrets: string[] = [];

  constructor(readonly policy: PublicationHardeningManifest = manifest) {}

  private response<T>(status: number, value: T | null = null) {
    return { status, value } as GitHubResponse<T>;
  }

  private base() {
    return `/repos/${this.policy.repository.owner}/${this.policy.repository.name}`;
  }

  private repository() {
    const settings = this.policy.repository.settings;
    return {
      allow_merge_commit: this.metadataReady ? settings.allowMergeCommit : true,
      allow_rebase_merge: this.metadataReady ? settings.allowRebaseMerge : true,
      allow_squash_merge: this.metadataReady
        ? settings.allowSquashMerge
        : false,
      archived: false,
      default_branch: "main",
      delete_branch_on_merge: this.metadataReady
        ? settings.deleteBranchOnMerge
        : false,
      description: this.metadataReady
        ? this.policy.repository.description
        : null,
      disabled: false,
      fork: false,
      has_discussions: this.metadataReady ? settings.hasDiscussions : true,
      has_issues: this.metadataReady ? settings.hasIssues : false,
      has_projects: this.metadataReady ? settings.hasProjects : true,
      has_wiki: this.metadataReady ? settings.hasWiki : true,
      homepage: this.metadataReady ? this.policy.repository.homepage : null,
      id: this.policy.repository.repositoryId,
      name: this.policy.repository.name,
      owner: {
        id: this.policy.repository.ownerId,
        login: this.policy.repository.owner,
      },
      permissions: { admin: true },
      private: false,
      security_and_analysis: {
        advanced_security: {
          status: this.securityReady ? "enabled" : "disabled",
        },
        dependency_graph: { status: "enabled" },
        secret_scanning: {
          status: this.securityReady ? "enabled" : "disabled",
        },
        secret_scanning_push_protection: {
          status: this.securityReady ? "enabled" : "disabled",
        },
      },
      visibility: "public",
    };
  }

  private protection() {
    const body = this.protectionBody ?? {};
    const toggle = (name: string) => enabled(body[name] === true);
    return {
      allow_deletions: toggle("allow_deletions"),
      allow_force_pushes: toggle("allow_force_pushes"),
      allow_fork_syncing: toggle("allow_fork_syncing"),
      block_creations: toggle("block_creations"),
      enforce_admins: toggle("enforce_admins"),
      lock_branch: toggle("lock_branch"),
      required_conversation_resolution: toggle(
        "required_conversation_resolution",
      ),
      required_linear_history: toggle("required_linear_history"),
      required_pull_request_reviews: body.required_pull_request_reviews,
      required_status_checks: body.required_status_checks,
      restrictions: body.restrictions ?? null,
    };
  }

  async request<T>(
    method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT",
    path: string,
    body?: unknown,
    _acceptedStatuses?: number[],
  ): Promise<GitHubResponse<T>> {
    this.calls.push({ body: structuredClone(body), method, path });
    const base = this.base();
    if (method === "GET" && path === "/user") {
      return this.response(200, {
        id: this.policy.repository.ownerId,
        login: this.policy.repository.owner,
        type: "User",
      }) as GitHubResponse<T>;
    }
    if (path === base) {
      if (method === "GET") {
        return this.response(200, this.repository()) as GitHubResponse<T>;
      }
      if (method === "PATCH") {
        const patch = body as Record<string, unknown>;
        const security = patch.security_and_analysis as Record<string, unknown>;
        if (Object.hasOwn(security, "dependency_graph")) {
          throw new Error("unsupported dependency_graph was sent");
        }
        this.metadataReady = true;
        this.securityReady = true;
        return this.response(200, this.repository()) as GitHubResponse<T>;
      }
    }
    if (method === "GET" && path === `${base}/git/ref/heads/main`) {
      return this.response(200, {
        object: { sha: sourceCommit, type: "commit" },
      }) as GitHubResponse<T>;
    }
    if (
      method === "GET" &&
      path ===
        `${base}/commits/${sourceCommit}/check-runs?filter=latest&per_page=100&page=1`
    ) {
      const check_runs = this.policy.branchProtection.requiredStatusChecks.map(
        ({ appId, context }, index) => ({
          app: { id: appId },
          conclusion: this.checksReady || index > 0 ? "success" : "failure",
          head_sha: sourceCommit,
          name: context,
          status: "completed",
        }),
      );
      return this.response(200, {
        check_runs,
        total_count: check_runs.length,
      }) as GitHubResponse<T>;
    }
    if (
      method === "GET" &&
      path === `${base}/actions/secrets?per_page=100&page=1`
    ) {
      const secrets = this.credentialPresent
        ? [
            { name: this.policy.credential.secretName },
            ...this.extraSecrets.map((name) => ({ name })),
          ]
        : this.extraSecrets.map((name) => ({ name }));
      return this.response(200, {
        secrets,
        total_count: secrets.length,
      }) as GitHubResponse<T>;
    }
    if (
      method === "GET" &&
      path === `${base}/collaborators?affiliation=all&per_page=100&page=1`
    ) {
      return this.response(200, [
        {
          id: this.policy.repository.ownerId,
          login: this.policy.repository.owner,
          permissions: { admin: true },
          role_name: "admin",
        },
        ...this.extraCollaborators,
      ]) as GitHubResponse<T>;
    }
    if (method === "GET" && path === `${base}/keys?per_page=100&page=1`) {
      return this.response(200, this.deployKeys) as GitHubResponse<T>;
    }
    if (path === `${base}/topics`) {
      if (method === "PUT") {
        this.topicsReady = true;
        return this.response(200, body) as GitHubResponse<T>;
      }
      return this.response(200, {
        names:
          this.topicsReady &&
          !this.breakFinalTopics &&
          this.topicLagReads-- <= 0
            ? this.policy.repository.topics
            : [],
      }) as GitHubResponse<T>;
    }
    if (path === `${base}/actions/permissions`) {
      if (method === "PUT") {
        this.actionsReady = true;
        return this.response(204) as GitHubResponse<T>;
      }
      return this.response(200, {
        allowed_actions: this.actionsReady ? "selected" : "all",
        enabled: true,
        sha_pinning_required: this.actionsReady,
      }) as GitHubResponse<T>;
    }
    if (path === `${base}/actions/permissions/selected-actions`) {
      if (method === "PUT") return this.response(204) as GitHubResponse<T>;
      if (!this.actionsReady) return this.response(409) as GitHubResponse<T>;
      return this.response(200, {
        github_owned_allowed: false,
        patterns_allowed: this.policy.actions.patternsAllowed,
        verified_allowed: false,
      }) as GitHubResponse<T>;
    }
    if (path === `${base}/actions/permissions/workflow`) {
      if (method === "PUT") {
        this.workflowReady = true;
        return this.response(204) as GitHubResponse<T>;
      }
      return this.response(200, {
        can_approve_pull_request_reviews: false,
        default_workflow_permissions: this.workflowReady ? "read" : "write",
      }) as GitHubResponse<T>;
    }
    if (path === `${base}/branches/main/protection`) {
      if (method === "PUT") {
        this.branchReady = true;
        this.protectionBody = structuredClone(body) as Record<string, unknown>;
        return this.response(200, this.protection()) as GitHubResponse<T>;
      }
      return this.branchReady
        ? (this.response(200, this.protection()) as GitHubResponse<T>)
        : (this.response(404) as GitHubResponse<T>);
    }
    if (path === `${base}/branches/main/protection/required_signatures`) {
      if (method === "POST") {
        this.signaturesReady = true;
        return this.response(200, { enabled: true }) as GitHubResponse<T>;
      }
      return this.signaturesReady
        ? (this.response(200, { enabled: true }) as GitHubResponse<T>)
        : (this.response(404) as GitHubResponse<T>);
    }
    if (path === `${base}/vulnerability-alerts`) {
      if (method === "PUT") {
        this.vulnerabilityAlertsReady = true;
        return this.response(204) as GitHubResponse<T>;
      }
      return this.response(
        this.vulnerabilityAlertsReady ? 204 : 404,
      ) as GitHubResponse<T>;
    }
    if (path === `${base}/automated-security-fixes`) {
      if (method === "PUT") {
        this.automatedFixesReady = true;
        return this.response(204) as GitHubResponse<T>;
      }
      return this.automatedFixesReady
        ? (this.response(200, {
            enabled: true,
            paused: false,
          }) as GitHubResponse<T>)
        : (this.response(404) as GitHubResponse<T>);
    }
    if (path === `${base}/private-vulnerability-reporting`) {
      if (method === "PUT") {
        this.privateReportingReady = true;
        return this.response(204) as GitHubResponse<T>;
      }
      return this.response(200, {
        enabled: this.privateReportingReady,
      }) as GitHubResponse<T>;
    }
    if (
      method === "DELETE" &&
      path === `${base}/actions/secrets/${this.policy.credential.secretName}`
    ) {
      this.credentialPresent = false;
      return this.response(204) as GitHubResponse<T>;
    }
    throw new Error(`Unexpected fake API call: ${method} ${path}`);
  }
}

describe("GitHub publication repository hardening", () => {
  test("validates the current reusable manifest and exact source workflow", async () => {
    expect(
      validatePublicationHardeningManifest(publicationManifestJson),
    ).toEqual(manifest);
    expect(manifest.repository).toMatchObject({
      name: "konsensus",
      owner: "konsensus-platform",
      ownerId: 292473859,
      repositoryId: 1319013036,
    });
    const source = await verifyPublicationHardeningSource(manifest);
    expect(source.requiredChecks.map(({ context }) => context)).toEqual([
      "checks",
      "gitleaks",
    ]);
    const workflow = await readFile(
      ".github/workflows/post-public-hardening.yml",
      "utf8",
    );
    const reference = "${{ secrets.PUBLICATION_HARDENING_TOKEN }}";
    expect(workflow.split(reference).length - 1).toBe(1);
    expect(workflow).toContain(
      `      - name: Apply, audit, and retire the one-time credential\n        env:\n          PUBLICATION_HARDENING_TOKEN: ${reference}\n        run: >-`,
    );
  });

  test("binds automatic and manual invocations to owner, repository, main and first attempt", () => {
    expect(invocationFromEnvironment(manifest, environment())).toEqual(
      invocation(),
    );
    expect(
      invocationFromEnvironment(
        manifest,
        environment({
          GITHUB_EVENT_NAME: "workflow_dispatch",
          PUBLICATION_HARDENING_CONFIRMATION: "harden-public-repository",
        }),
      ).eventName,
    ).toBe("workflow_dispatch");
    const invalidInvocations: Array<Record<string, string>> = [
      { PUBLICATION_ACTOR_ID: "9" },
      { PUBLICATION_REPOSITORY_ID: "9" },
      { PUBLICATION_REPOSITORY_VISIBILITY: "private" },
      { GITHUB_RUN_ATTEMPT: "2" },
      { PUBLICATION_WORKFLOW_SHA: "b".repeat(40) },
    ];
    for (const overrides of invalidInvocations) {
      expect(() =>
        invocationFromEnvironment(manifest, environment(overrides)),
      ).toThrow();
    }
  });

  test("applies every target, audits it, and deletes the one-time secret last", async () => {
    const api = new FakeApi();
    const evidence = await applyAndRetirePublicationHardening(
      manifest,
      api,
      invocation(),
      { auditDelayMs: 0 },
    );
    expect(evidence.targetReady).toBe(true);
    expect(evidence.credentialRetired).toBe(true);
    expect(api.credentialPresent).toBe(false);
    expect(api.calls.at(-2)).toEqual({
      body: undefined,
      method: "DELETE",
      path: "/repos/konsensus-platform/konsensus/actions/secrets/PUBLICATION_HARDENING_TOKEN",
    });
    expect(api.calls.at(-1)?.path).toBe(
      "/repos/konsensus-platform/konsensus/actions/secrets?per_page=100&page=1",
    );
    const patch = api.calls.find(
      (call) =>
        call.method === "PATCH" &&
        call.path === "/repos/konsensus-platform/konsensus",
    );
    expect(
      Object.hasOwn(
        (patch?.body as Record<string, Record<string, unknown>>)
          .security_and_analysis,
        "dependency_graph",
      ),
    ).toBe(false);
  });

  test("does not mutate when a required source check is not successful", async () => {
    const api = new FakeApi();
    api.checksReady = false;
    await expect(
      applyAndRetirePublicationHardening(manifest, api, invocation()),
    ).rejects.toThrow("required_check_not_successful:checks");
    expect(api.calls.some((call) => call.method !== "GET")).toBe(false);
    expect(api.credentialPresent).toBe(true);
  });

  test("refuses unexpected secrets, writers, or deploy keys before mutation", async () => {
    for (const configure of [
      (api: FakeApi) => {
        api.extraSecrets = ["UNEXPECTED_SECRET"];
      },
      (api: FakeApi) => {
        api.extraCollaborators = [
          {
            id: 9,
            login: "unexpected-writer",
            permissions: { push: true },
            role_name: "write",
          },
        ];
      },
      (api: FakeApi) => {
        api.deployKeys = [{ id: 9, read_only: false, title: "unexpected" }];
      },
    ]) {
      const api = new FakeApi();
      configure(api);
      await expect(
        applyAndRetirePublicationHardening(manifest, api, invocation()),
      ).rejects.toThrow(
        /repository_(access_inventory|deploy_keys|secret_inventory)/,
      );
      expect(api.calls.some((call) => call.method !== "GET")).toBe(false);
      expect(api.credentialPresent).toBe(true);
    }
  });

  test("retains the one-time secret when the exact post-apply audit fails", async () => {
    const api = new FakeApi();
    api.breakFinalTopics = true;
    await expect(
      applyAndRetirePublicationHardening(manifest, api, invocation(), {
        auditAttempts: 2,
        auditDelayMs: 0,
      }),
    ).rejects.toThrow("repository_topics");
    expect(api.credentialPresent).toBe(true);
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  test("re-audits eventual consistency without repeating mutations", async () => {
    const api = new FakeApi();
    api.topicLagReads = 1;
    await applyAndRetirePublicationHardening(manifest, api, invocation(), {
      auditAttempts: 3,
      auditDelayMs: 0,
    });
    expect(
      api.calls.filter(
        (call) =>
          call.method === "PATCH" &&
          call.path === "/repos/konsensus-platform/konsensus",
      ),
    ).toHaveLength(1);
    expect(api.credentialPresent).toBe(false);
  });

  test("rejects manifest weakening and extra fields", () => {
    for (const candidate of [
      {
        ...publicationManifestJson,
        credential: { secretName: "SOME_TOKEN" },
      },
      {
        ...publicationManifestJson,
        security: {
          ...publicationManifestJson.security,
          secretScanning: false,
        },
      },
      {
        ...publicationManifestJson,
        branchProtection: {
          ...publicationManifestJson.branchProtection,
          requiredApprovingReviewCount: 1,
        },
      },
      {
        ...publicationManifestJson,
        branchProtection: {
          ...publicationManifestJson.branchProtection,
          requiredStatusChecks:
            publicationManifestJson.branchProtection.requiredStatusChecks.map(
              (check, index) => (index === 0 ? { ...check, appId: 1 } : check),
            ),
        },
      },
      { ...publicationManifestJson, obsoleteCompatibility: true },
    ]) {
      expect(() => validatePublicationHardeningManifest(candidate)).toThrow();
    }
    expect(canonicalJson(manifest)).not.toContain("obsoleteCompatibility");
  });

  test("locks REST requests to the reviewed API origin", async () => {
    expect(() => new GitHubRestApi(" ")).toThrow(
      "Missing PUBLICATION_HARDENING_TOKEN",
    );
    expect(
      () => new GitHubRestApi("credential", "https://example.test"),
    ).toThrow("api.github.com");
    const requests: Request[] = [];
    const api = new GitHubRestApi(
      "credential",
      "https://api.github.com",
      (async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ ok: true });
      }) as typeof fetch,
    );
    await expect(api.request("GET", "//example.test/path")).rejects.toThrow(
      "escaped",
    );
    expect(requests).toHaveLength(0);
    await api.request("GET", "/user");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.github.com/user");
    expect(requests[0]?.redirect).toBe("error");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer credential");
  });
});
