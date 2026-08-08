import type { z } from "zod";
import {
  type PublicDataExportKind,
  type PublicDataExportResponse,
  type PublicEligibilityDirectoryBundle,
  type PublicEligibilityDirectoryCheckpointHistory,
  type PublicEligibilityDirectoryRecordProof,
  type PublicIssueListResponse,
  type PublicIssueOverview,
  type PublicIssueQuestionsResponse,
  type PublicQuestionCounts,
  type PublicTallySnapshotResponse,
  type PublicVerificationProofResponse,
  type PublicVoteProofResponse,
  publicDataExportSchemas,
  publicEligibilityDirectoryBundleSchema,
  publicEligibilityDirectoryCheckpointHistorySchema,
  publicEligibilityDirectoryRecordProofSchema,
  publicIssueListResponseSchema,
  publicIssueOverviewSchema,
  publicIssueQuestionsResponseSchema,
  publicQuestionCountsSchema,
  publicTallySnapshotResponseSchema,
  publicTransparencyCheckpointResponseSchema,
  publicTransparencyConsistencyResponseSchema,
  publicTransparencyEntriesResponseSchema,
  publicTransparencyInclusionResponseSchema,
  publicVerificationProofResponseSchema,
  publicVoteProofResponseSchema,
} from "./schemas";

export type PublicApiFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type PublicApiClientOptions = {
  baseUrl: string | URL;
  fetch?: PublicApiFetch;
};

export type PublicApiRequestOptions = {
  signal?: AbortSignal;
};

export class PublicApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(input: {
    status: number;
    code: string;
    body: unknown;
    message?: string;
  }) {
    super(
      input.message ??
        `Public API request failed (${input.status}: ${input.code})`,
    );
    this.name = "PublicApiError";
    this.status = input.status;
    this.code = input.code;
    this.body = input.body;
  }
}

function normalizedBaseUrl(value: string | URL) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

function pathSegment(value: string) {
  return encodeURIComponent(value);
}

function addOptionalParameter(
  parameters: URLSearchParams,
  name: string,
  value: number | string | undefined,
) {
  if (value !== undefined && value !== "") {
    parameters.set(name, String(value));
  }
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class PublicApiClient {
  readonly baseUrl: URL;
  readonly fetcher: PublicApiFetch;

  constructor(options: PublicApiClientOptions) {
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private url(relativePath = "", parameters?: URLSearchParams) {
    const url = new URL(relativePath.replace(/^\/+/, ""), this.baseUrl);
    if (parameters) url.search = parameters.toString();
    return url;
  }

  private async get<TSchema extends z.ZodTypeAny>(
    relativePath: string,
    schema: TSchema,
    options: PublicApiRequestOptions = {},
    parameters?: URLSearchParams,
  ): Promise<z.output<TSchema>> {
    const response = await this.fetcher(this.url(relativePath, parameters), {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
    const body = await responseBody(response);
    if (!response.ok) {
      const code =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "request_failed";
      throw new PublicApiError({ status: response.status, code, body });
    }
    return schema.parse(body);
  }

  listIssues(
    input: {
      q?: string;
      matter?: string;
      status?: string;
    } = {},
    options?: PublicApiRequestOptions,
  ): Promise<PublicIssueListResponse> {
    const parameters = new URLSearchParams();
    addOptionalParameter(parameters, "q", input.q);
    addOptionalParameter(parameters, "matter", input.matter);
    addOptionalParameter(parameters, "status", input.status);
    return this.get(
      "issues",
      publicIssueListResponseSchema,
      options,
      parameters,
    );
  }

  getIssue(
    slug: string,
    options?: PublicApiRequestOptions,
  ): Promise<PublicIssueOverview> {
    return this.get(
      `issues/${pathSegment(slug)}`,
      publicIssueOverviewSchema,
      options,
    );
  }

  listIssueQuestions(
    slug: string,
    options?: PublicApiRequestOptions,
  ): Promise<PublicIssueQuestionsResponse> {
    return this.get(
      `issues/${pathSegment(slug)}/questions`,
      publicIssueQuestionsResponseSchema,
      options,
    );
  }

  getQuestionCounts(
    id: string,
    options?: PublicApiRequestOptions,
  ): Promise<PublicQuestionCounts> {
    return this.get(
      `questions/${pathSegment(id)}/counts`,
      publicQuestionCountsSchema,
      options,
    );
  }

  getEligibilityDirectory(
    options?: PublicApiRequestOptions,
  ): Promise<PublicEligibilityDirectoryBundle> {
    return this.get(
      "eligibility-directory",
      publicEligibilityDirectoryBundleSchema,
      options,
    );
  }

  getEligibilityDirectoryRecord(
    publicVoterId: string,
    options?: PublicApiRequestOptions,
  ): Promise<PublicEligibilityDirectoryRecordProof> {
    return this.get(
      `eligibility-directory/${pathSegment(publicVoterId)}`,
      publicEligibilityDirectoryRecordProofSchema,
      options,
    );
  }

  getEligibilityDirectoryCheckpoints(
    input: { start?: number; limit?: number } = {},
    options?: PublicApiRequestOptions,
  ): Promise<PublicEligibilityDirectoryCheckpointHistory> {
    const parameters = new URLSearchParams();
    addOptionalParameter(parameters, "start", input.start);
    addOptionalParameter(parameters, "limit", input.limit);
    return this.get(
      "eligibility-directory/checkpoints",
      publicEligibilityDirectoryCheckpointHistorySchema,
      options,
      parameters,
    );
  }

  getQuestionVoteCheckpoint(id: string, options?: PublicApiRequestOptions) {
    return this.get(
      `questions/${pathSegment(id)}/vote-checkpoint`,
      publicTransparencyCheckpointResponseSchema,
      options,
    );
  }

  getData<K extends PublicDataExportKind>(
    kind: K,
    input: { limit?: number; offset?: number } = {},
    options?: PublicApiRequestOptions,
  ): Promise<PublicDataExportResponse<K>> {
    const parameters = new URLSearchParams();
    addOptionalParameter(parameters, "limit", input.limit);
    addOptionalParameter(parameters, "offset", input.offset);
    return this.get(
      `data/${kind}`,
      publicDataExportSchemas[kind],
      options,
      parameters,
    ) as Promise<PublicDataExportResponse<K>>;
  }

  getVerificationProof(
    proofId: string,
    options?: PublicApiRequestOptions,
  ): Promise<PublicVerificationProofResponse> {
    return this.get(
      `verification-proofs/${pathSegment(proofId)}`,
      publicVerificationProofResponseSchema,
      options,
    );
  }

  getVoteProof(
    id: string,
    options?: PublicApiRequestOptions,
  ): Promise<PublicVoteProofResponse> {
    return this.get(
      `vote-proofs/${pathSegment(id)}`,
      publicVoteProofResponseSchema,
      options,
    );
  }

  getTallySnapshot(
    id: string,
    options?: PublicApiRequestOptions,
  ): Promise<PublicTallySnapshotResponse> {
    return this.get(
      `tally-snapshots/${pathSegment(id)}`,
      publicTallySnapshotResponseSchema,
      options,
    );
  }

  getTransparencyCheckpoint(
    treeSize?: number,
    options?: PublicApiRequestOptions,
  ) {
    const parameters = new URLSearchParams();
    addOptionalParameter(parameters, "size", treeSize);
    return this.get(
      "transparency/checkpoint",
      publicTransparencyCheckpointResponseSchema,
      options,
      parameters,
    );
  }

  getTransparencyConsistency(
    input: { from: number; to: number },
    options?: PublicApiRequestOptions,
  ) {
    const parameters = new URLSearchParams({
      from: String(input.from),
      to: String(input.to),
    });
    return this.get(
      "transparency/consistency",
      publicTransparencyConsistencyResponseSchema,
      options,
      parameters,
    );
  }

  getTransparencyEntries(
    input: { start?: number; limit?: number } = {},
    options?: PublicApiRequestOptions,
  ) {
    const parameters = new URLSearchParams();
    addOptionalParameter(parameters, "start", input.start);
    addOptionalParameter(parameters, "limit", input.limit);
    return this.get(
      "transparency/entries",
      publicTransparencyEntriesResponseSchema,
      options,
      parameters,
    );
  }

  getTransparencyInclusion(
    input: { index: number; size: number },
    options?: PublicApiRequestOptions,
  ) {
    const parameters = new URLSearchParams({
      index: String(input.index),
      size: String(input.size),
    });
    return this.get(
      "transparency/inclusion",
      publicTransparencyInclusionResponseSchema,
      options,
      parameters,
    );
  }
}
