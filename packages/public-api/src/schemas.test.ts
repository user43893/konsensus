import { describe, expect, test } from "bun:test";
import {
  PUBLIC_API_PATHS,
  jsonDateTimeSchema,
  publicIssueListResponseSchema,
  publicIssueSchema,
  publicQuestionCountsSchema,
  publicSourceSchema,
  publicVerificationProofResponseSchema,
} from "./schemas";

describe("current unversioned public API schemas", () => {
  test("normalizes dates and strips database/editorial fields", () => {
    const updatedAt = new Date("2026-07-23T12:00:00.000Z");
    const issue = publicIssueSchema.parse({
      id: "issue",
      slug: "public-issue",
      title: "Public issue",
      shortTitle: null,
      summary: "Summary",
      plainLanguageSummary: "Plain summary",
      countryCode: "NZ",
      jurisdictionLabel: "New Zealand",
      status: "active",
      openedAt: null,
      closedAt: null,
      currentStatusText: "Open",
      updatedAt,
      visibility: "public",
      internalReviewerNotes: "must never cross the boundary",
      createdAt: updatedAt,
    });

    expect(issue.updatedAt).toBe("2026-07-23T12:00:00.000Z");
    expect(issue).not.toHaveProperty("visibility");
    expect(issue).not.toHaveProperty("internalReviewerNotes");
    expect(issue).not.toHaveProperty("createdAt");
  });

  test("normalizes offset-bearing database timestamps used by current reads", () => {
    expect(jsonDateTimeSchema.parse("2026-07-23 12:00:00+00")).toBe(
      "2026-07-23T12:00:00.000Z",
    );
    expect(() => jsonDateTimeSchema.parse("2026-07-23 12:00:00")).toThrow(
      "explicit UTC offset",
    );
  });

  test("keeps tally totals neutral and strips instance-only segments", () => {
    const counts = publicQuestionCountsSchema.parse({
      legalQuestionId: "question",
      totalCount: 3,
      directVoteCount: 2,
      publicStatementCount: 1,
      disputedCount: 0,
      instanceGroupCount: 1,
      scoreWeights: { instanceGroup: 3 },
      choices: [
        {
          id: "choice",
          legalQuestionId: "question",
          slug: "yes",
          label: "Yes",
          displayOrder: 1,
          isCounted: true,
          count: 3,
          percentage: 100,
          rawPercentage: 100,
          scorePercentage: 100,
          instanceGroupCount: 1,
        },
      ],
    });

    expect(counts).not.toHaveProperty("instanceGroupCount");
    expect(counts).not.toHaveProperty("scoreWeights");
    expect(counts.choices[0]).not.toHaveProperty("instanceGroupCount");
  });

  test("publishes only current unversioned read endpoint templates", () => {
    expect(PUBLIC_API_PATHS.issues).toBe("/api/issues");
    expect(Object.values(PUBLIC_API_PATHS)).not.toContainEqual(
      expect.stringMatching(/\/api\/v\d(?:\/|$)/),
    );
    expect(JSON.stringify(PUBLIC_API_PATHS)).not.toMatch(
      /login|register|delegation|session/,
    );
  });

  test("accepts only credential-free absolute HTTP(S) source URLs or null", () => {
    const source = {
      id: "source",
      sourceType: "official",
      url: "https://example.test/document?id=1#section",
      canonicalUrl: "http://archive.example.test/document",
      archiveUrl: null,
      title: "Source",
      publisher: null,
      authorText: null,
      languageCode: "en",
      publishedAt: null,
      capturedAt: null,
      sourceStatus: "available",
      summary: null,
      updatedAt: "2026-07-23T12:00:00.000Z",
    };
    expect(publicSourceSchema.parse(source).archiveUrl).toBeNull();

    for (const unsafeUrl of [
      "//evil.example/document",
      "/relative/document",
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "https://user:secret@example.test/document",
      " https://example.test/document",
    ]) {
      expect(() =>
        publicSourceSchema.parse({ ...source, url: unsafeUrl }),
      ).toThrow();
    }
  });

  test("accepts the current non-paginated issue collection", () => {
    expect(publicIssueListResponseSchema.parse({ issues: [] })).toEqual({
      issues: [],
    });
  });

  test("requires current V3 verification payloads", () => {
    const response = {
      receipt: {
        payload: {
          schema: "qualified-opinion.email-control-passkey.v3",
          result: "synthetic",
        },
        attestationToken: "header.payload.signature",
      },
      payloadSha256: "digest",
      verification: { valid: true },
      attestationSummary: {
        issuer: null,
        audience: null,
        subject: null,
        imageDigest: null,
        swName: null,
        debugStatus: null,
        serviceAccounts: [],
      },
      limitation: "Synthetic fixture.",
    };
    expect(() =>
      publicVerificationProofResponseSchema.parse(response),
    ).not.toThrow();
    expect(() =>
      publicVerificationProofResponseSchema.parse({
        ...response,
        receipt: {
          ...response.receipt,
          payload: {
            ...response.receipt.payload,
            schema: ["qualified-opinion.fixture", "v", "2"].join("."),
          },
        },
      }),
    ).toThrow("current V3");
  });
});
