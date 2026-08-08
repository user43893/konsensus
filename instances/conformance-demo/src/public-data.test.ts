import { describe, expect, test } from "bun:test";
import { verifyPublicVoteProofBundleV3Integrity } from "@konsensus/proof";
import {
  publicIssueListResponseSchema,
  publicIssueOverviewSchema,
  publicTransparencyCheckpointResponseSchema,
  publicVerificationProofResponseSchema,
  publicVoteProofResponseSchema,
} from "@konsensus/public-api";
import {
  demoIssueList,
  demoIssueOverviews,
  demoTransparencyCheckpoint,
  demoVerificationProofs,
  demoVoteProofs,
} from "./public-data";

describe("deployable conformance instance", () => {
  test("publishes data accepted by the neutral current public contract", () => {
    expect(() =>
      publicIssueListResponseSchema.parse(demoIssueList),
    ).not.toThrow();

    for (const overview of Object.values(demoIssueOverviews)) {
      expect(() => publicIssueOverviewSchema.parse(overview)).not.toThrow();
      expect(overview.events.length).toBeGreaterThan(0);
      expect(overview.proceedings.length).toBeGreaterThan(0);
      expect(overview.decisions.length).toBeGreaterThan(0);
    }
    for (const proof of Object.values(demoVerificationProofs)) {
      expect(() =>
        publicVerificationProofResponseSchema.parse(proof),
      ).not.toThrow();
    }
    for (const proof of Object.values(demoVoteProofs)) {
      expect(() => publicVoteProofResponseSchema.parse(proof)).not.toThrow();
    }
    expect(() =>
      publicTransparencyCheckpointResponseSchema.parse(
        demoTransparencyCheckpoint,
      ),
    ).not.toThrow();
  });

  test("publishes an internally linked current V3 vote proof", async () => {
    const proof = demoVoteProofs["synthetic-vote-v3"];
    expect(await verifyPublicVoteProofBundleV3Integrity(proof.bundle)).toEqual({
      ok: true,
      value: proof.bundle,
    });
    expect(proof.bundle.schema).toBe(
      "qualified-opinion.public-vote-proof-bundle.v3",
    );
    expect(
      demoVerificationProofs["synthetic-eligibility-v3"].receipt.payload.schema,
    ).toBe("qualified-opinion.email-control-passkey.v3");
  });

  test("contains only synthetic records and reserved example links", () => {
    const serialized = JSON.stringify({
      demoIssueList,
      demoIssueOverviews,
      demoVerificationProofs,
      demoVoteProofs,
    });

    expect(serialized).toContain("synthetic");
    expect(serialized).not.toMatch(/[.-]v[12](?![0-9])/i);
    for (const match of serialized.matchAll(/https?:\/\/[^"\\]+/g)) {
      const hostname = new URL(match[0]).hostname;
      expect(
        hostname === "example.test" || hostname.endsWith(".example.test"),
      ).toBe(true);
    }
  });
});
