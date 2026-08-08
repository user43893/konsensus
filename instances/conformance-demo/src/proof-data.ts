import { instanceProfileSha256 } from "@konsensus/instance-profile";
import {
  type JsonValue,
  VOTE_EVENT_SCHEMA_V3,
  attachDetachedSignature,
  base64UrlEncode,
  buildActiveEligibilityDirectoryBundleV3,
  buildActiveEligibilityDirectoryCheckpointV3,
  buildActiveEligibilityDirectoryLeavesV3,
  buildActiveEligibilityDirectoryRecordProofV3,
  buildActiveEligibilityDirectoryRecordV3,
  buildBallotManifestV3,
  buildEligibilityAssertionV3,
  buildEligibilityDecisionV3,
  buildIdentityAttestationPolicyV3,
  buildMerkleTreeHeadV3,
  buildProtocolBindingV3,
  buildPublicVoteProofBundleV3,
  buildQuestionVotingAuthorizationPayloadV3,
  buildQuestionVotingAuthorizationV3,
  buildRegistryEvidenceV3,
  buildVoteAcceptanceV3,
  buildVoteEventV3,
  canonicalJsonSha256,
  canonicalizeJson,
  createMerkleInclusionProof,
  questionVoteLogIdV3,
  sha256Base64Url,
  verifyActiveEligibilityDirectoryBundleIntegrityV3,
  verifyPublicVoteProofBundleV3Integrity,
} from "@konsensus/proof";
import {
  publicEligibilityDirectoryBundleSchema,
  publicEligibilityDirectoryCheckpointHistorySchema,
  publicEligibilityDirectoryRecordProofSchema,
  publicTransparencyCheckpointResponseSchema,
  publicTransparencyConsistencyResponseSchema,
  publicTransparencyEntriesResponseSchema,
  publicTransparencyInclusionResponseSchema,
  publicVerificationProofResponseSchema,
  publicVoteProofResponseSchema,
} from "@konsensus/public-api";
import { conformanceDemoProfile } from "./profile";

const syntheticTimestamp = "2026-07-01T00:00:00.000Z";
const syntheticQuestionKeySpki = [
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcD",
  "QgAEdRbV4Qw44Uloa92nXoVOt2XyUoqc1p",
  "ioQvggs3--NM1TQf1DbOJ6gDRSk2WideD5d",
  "KNWHTE3idAdM9ka-0eJFQ",
].join("");

function digest(byte: number) {
  return base64UrlEncode(new Uint8Array(32).fill(byte));
}

function signature(byte: number) {
  return base64UrlEncode(new Uint8Array(64).fill(byte));
}

const syntheticAttestationToken = ["header", "synthetic", "signature"]
  .map((part) => base64UrlEncode(new TextEncoder().encode(part)))
  .join(".");

async function buildSyntheticVoteBundleV3() {
  const binding = buildProtocolBindingV3({
    instanceId: conformanceDemoProfile.id,
    instanceProfileSha256: await instanceProfileSha256(conformanceDemoProfile),
    eligibilityPolicy: {
      id: conformanceDemoProfile.qualification.policyId,
      sha256: digest(1),
    },
    tallyPolicy: {
      id: conformanceDemoProfile.opinionIndex.policyId,
      sha256: digest(2),
    },
    trustPolicy: {
      id: "example.nz.synthetic-attestation.v3",
      sha256: digest(3),
    },
    audience: "https://platform.example.test/api/voting",
    origin: "https://platform.example.test",
  });
  const authorization = await buildQuestionVotingAuthorizationV3({
    payload: await buildQuestionVotingAuthorizationPayloadV3({
      binding,
      questionId: "question-coastal-access",
      questionNullifier: digest(4),
      nullifierKeyEpoch: 1,
      questionKeyPublicKeySpki: syntheticQuestionKeySpki,
      eligibilityClaim: "synthetic-qualified-participant",
      registryCheckpointId: "synthetic-registry-checkpoint-v3",
      registryCheckpointSha256: digest(5),
      registryCheckpointWitnessCanonicalEnvelope: "{}",
      registryCheckpointWitnessEnvelopeSha256: await sha256Base64Url("{}"),
      issuedAt: syntheticTimestamp,
      expiresAt: "2026-07-01T00:15:00.000Z",
      issuerAttestationAudience:
        "https://attestation.example.test/question-authorization",
    }),
    attestationToken: syntheticAttestationToken,
  });
  const manifest = buildBallotManifestV3({
    manifestId: "synthetic-coastal-manifest-v3",
    ballotId: "synthetic-coastal-ballot-v3",
    questionId: "question-coastal-access",
    nullifierKeyEpoch: 1,
    revision: 1,
    binding,
    meaningChoices: [
      {
        id: "choice-strengthen",
        slug: "strengthen",
        semanticCode: "support",
        displayOrder: 1,
        isCounted: true,
      },
      {
        id: "choice-retain",
        slug: "retain",
        semanticCode: "oppose",
        displayOrder: 2,
        isCounted: true,
      },
    ],
    locale: "en-NZ",
    questionText: "Should the statutory coastal-access duty be strengthened?",
    plainLanguageText:
      "Should public walking access receive stronger legal protection?",
    presentationChoices: [
      {
        id: "choice-strengthen",
        label: "Strengthen the access duty",
        description: "Strengthen the statutory public-access duty.",
      },
      {
        id: "choice-retain",
        label: "Retain the current framework",
        description: "Retain the current statutory framework.",
      },
    ],
    publishedAt: "2026-06-30T23:00:00.000Z",
    issuerKeyId: "synthetic-receipt-key-v3",
  });
  const questionManifest = await attachDetachedSignature(manifest, {
    algorithm: "Ed25519",
    keyId: manifest.issuer.keyId,
    value: signature(6),
  });
  const event = buildVoteEventV3({
    eventId: "synthetic-vote-v3",
    eventType: "cast",
    binding,
    questionNullifier: authorization.payload.questionNullifier,
    authorizationSha256: authorization.payloadSha256,
    publicationMode: "private",
    ballotManifestSha256: questionManifest.payloadSha256,
    ballotId: manifest.ballotId,
    questionId: manifest.questionId,
    choiceId: "choice-strengthen",
    sequence: 1,
    challenge: base64UrlEncode(new Uint8Array(24).fill(7)),
    issuedAt: "2026-07-01T00:05:00.000Z",
    questionKeyId: authorization.payload.questionKey.keyId,
  });
  const voteEvent = await attachDetachedSignature(event, {
    algorithm: "ES256",
    keyId: event.questionKeyId,
    value: signature(8),
  });
  const receipt = buildVoteAcceptanceV3({
    receiptId: "synthetic-acceptance-v3",
    voteEventSha256: voteEvent.payloadSha256,
    status: "counted",
    logId: await questionVoteLogIdV3({
      instanceId: binding.instance.id,
      questionId: manifest.questionId,
    }),
    receivedAt: "2026-07-01T00:05:01.000Z",
    issuerKeyId: manifest.issuer.keyId,
  });
  const acceptance = await attachDetachedSignature(receipt, {
    algorithm: "Ed25519",
    keyId: receipt.issuerKeyId,
    value: signature(9),
  });
  const leaves = [
    canonicalizeJson({
      entryId: event.eventId,
      entryPayloadHash: voteEvent.payloadSha256,
      entryType: "vote_event",
    }),
    canonicalizeJson({
      entryId: receipt.receiptId,
      entryPayloadHash: acceptance.payloadSha256,
      entryType: "vote_adjudication",
    }),
  ];
  const [voteProof, acceptanceProof] = await Promise.all([
    createMerkleInclusionProof(leaves, 0),
    createMerkleInclusionProof(leaves, 1),
  ]);
  const treeHead = await attachDetachedSignature(
    buildMerkleTreeHeadV3({
      logId: receipt.logId,
      treeSize: 2,
      rootHash: voteProof.rootHash,
      issuedAt: "2026-07-01T00:05:02.000Z",
      issuerKeyId: receipt.issuerKeyId,
    }),
    {
      algorithm: "Ed25519",
      keyId: receipt.issuerKeyId,
      value: signature(10),
    },
  );
  return buildPublicVoteProofBundleV3({
    bundleId: event.eventId,
    questionAuthorization: authorization,
    questionManifest,
    voteEvent,
    acceptance,
    voteEventTransparency: {
      leafIndex: voteProof.leafIndex,
      leafHash: voteProof.leafHash,
      auditPath: voteProof.auditPath,
      treeHead,
    },
    acceptanceTransparency: {
      leafIndex: acceptanceProof.leafIndex,
      leafHash: acceptanceProof.leafHash,
      auditPath: acceptanceProof.auditPath,
      treeHead,
    },
  });
}

export const demoVoteProofBundleV3 = await buildSyntheticVoteBundleV3();
const bundleIntegrity = await verifyPublicVoteProofBundleV3Integrity(
  demoVoteProofBundleV3,
);
if (!bundleIntegrity.ok) {
  throw new TypeError(
    `Synthetic V3 proof fixture is invalid: ${bundleIntegrity.errors.join("; ")}`,
  );
}

const verificationReceiptPayload = {
  schema: "qualified-opinion.email-control-passkey.v3",
  result: "email_control_verified",
  requestId: "synthetic-verification-request-v3",
  claimedFullName: "Synthetic Participant",
  claimedEmail: "participant@example.test",
  normalizedEmail: "participant@example.test",
  verificationMethod: "one_time_email_code",
  verifiedAt: syntheticTimestamp,
  verifierVersion: "synthetic-v3",
  passkey: {
    credentialId: base64UrlEncode(new TextEncoder().encode("synthetic-key")),
    publicKeySpki: syntheticQuestionKeySpki,
    algorithm: "ES256",
    rpId: "platform.example.test",
    origin: "https://platform.example.test",
    signCount: 1,
    transports: ["internal"],
    userHandle: base64UrlEncode(new TextEncoder().encode("synthetic-user")),
    proofOfPossession: {
      registration: {
        challenge: digest(11),
        clientDataJson: digest(12),
        attestationObject: digest(13),
      },
      assertion: {
        challenge: digest(14),
        clientDataJson: digest(15),
        authenticatorData: digest(16),
        signature: signature(17),
        userHandle: null,
      },
    },
  },
  limitations: [
    "Synthetic demonstration only; no person, mailbox, registry, or workload is attested.",
  ],
} as const;

const eligibilitySignature = {
  algorithm: "Ed25519" as const,
  keyId: "synthetic-eligibility-key-v3",
  value: signature(24),
};
const publicVoterId = "10000000-0000-4000-8000-000000000001";
const qualificationSubject = {
  scheme: conformanceDemoProfile.qualification.subjectKeyScheme,
  issuer: conformanceDemoProfile.qualification.subjectIssuer,
  key: "synthetic-participant-1",
};
const registryEvidence = buildRegistryEvidenceV3({
  reviewId: "synthetic-registry-review-v3",
  reviewerAuthority: conformanceDemoProfile.qualification.issuer,
  subject: qualificationSubject,
  recordUrl: "https://registry.example.test/participants/1",
  checkedFullName: verificationReceiptPayload.claimedFullName,
  checkedEmail: verificationReceiptPayload.normalizedEmail,
  checkedAt: syntheticTimestamp,
});
const identityAttestationPolicy = buildIdentityAttestationPolicyV3({
  policyId: "synthetic-identity-attestation-v3",
  audience: "synthetic-email-verification",
  imageDigest: `sha256:${"a".repeat(64)}`,
  projectId: "synthetic-project",
  serviceAccount: "reference@example.test",
  expectedEnvironment: {
    EXAMPLE_WEBAUTHN_ORIGIN: "https://platform.example.test",
    EXAMPLE_WEBAUTHN_RP_ID: "platform.example.test",
  },
  allowDebug: false,
  pkiRootCertificateSha256: "AA:BB:CC",
  identityOrigin: "https://platform.example.test",
  rpId: "platform.example.test",
});
const registrationPayload = structuredClone(
  verificationReceiptPayload,
) as unknown as JsonValue;
const registrationPayloadSha256 =
  await canonicalJsonSha256(registrationPayload);
const eligibilityBinding =
  demoVoteProofBundleV3.questionAuthorization.payload.binding;
const eligibilityAssertionPayload = await buildEligibilityAssertionV3({
  assertionId: "synthetic-eligibility-assertion-v3",
  publicVoterId,
  binding: eligibilityBinding,
  identityProof: {
    proofId: "synthetic-eligibility-v3",
    payloadSha256: registrationPayloadSha256,
  },
  identityAttestationPolicy,
  rootKey: {
    credentialId: verificationReceiptPayload.passkey.credentialId,
    publicKeySpkiSha256: digest(25),
  },
  qualificationClaim: "synthetic-qualified-participant",
  subject: qualificationSubject,
  registryEvidence,
  issuedAt: syntheticTimestamp,
  issuerKeyId: eligibilitySignature.keyId,
});
const eligibilityAssertion = await attachDetachedSignature(
  eligibilityAssertionPayload,
  eligibilitySignature,
);
const eligibilityDecision = await attachDetachedSignature(
  buildEligibilityDecisionV3({
    decisionId: "synthetic-eligibility-decision-v3",
    assertionSha256: eligibilityAssertion.payloadSha256,
    publicVoterId,
    sequence: 1,
    status: "active",
    reason: "synthetic_initial_approval",
    effectiveAt: syntheticTimestamp,
    issuerKeyId: eligibilitySignature.keyId,
  }),
  eligibilitySignature,
);
const eligibilityRecord = await buildActiveEligibilityDirectoryRecordV3({
  publicVoterId,
  registration: {
    proofId: "synthetic-eligibility-v3",
    payload: registrationPayload,
    payloadSha256: registrationPayloadSha256,
    attestationToken: syntheticAttestationToken,
  },
  eligibilityAssertion,
  eligibilityDecision,
});
const eligibilityLeaves = await buildActiveEligibilityDirectoryLeavesV3([
  eligibilityRecord,
]);
const eligibilityCheckpoint = await attachDetachedSignature(
  await buildActiveEligibilityDirectoryCheckpointV3({
    directoryId: `${conformanceDemoProfile.id}.active-eligibility-directory.v3`,
    instanceId: conformanceDemoProfile.id,
    protocolBindingSha256: await canonicalJsonSha256(eligibilityBinding),
    sequence: 1,
    previousCheckpointSha256: null,
    issuedAt: syntheticTimestamp,
    issuerKeyId: eligibilitySignature.keyId,
    leaves: eligibilityLeaves,
  }),
  eligibilitySignature,
);

export const demoEligibilityDirectory =
  publicEligibilityDirectoryBundleSchema.parse(
    buildActiveEligibilityDirectoryBundleV3({
      checkpoint: eligibilityCheckpoint,
      records: [eligibilityRecord],
    }),
  );
const eligibilityDirectoryIntegrity =
  await verifyActiveEligibilityDirectoryBundleIntegrityV3(
    demoEligibilityDirectory,
  );
if (!eligibilityDirectoryIntegrity.ok) {
  throw new TypeError(
    `Synthetic eligibility directory is invalid: ${eligibilityDirectoryIntegrity.errors.join("; ")}`,
  );
}
const eligibilityRecordProof =
  await buildActiveEligibilityDirectoryRecordProofV3({
    checkpoint: eligibilityCheckpoint,
    records: [eligibilityRecord],
    publicVoterId,
  });
export const demoEligibilityDirectoryRecordProofs = {
  [publicVoterId]: publicEligibilityDirectoryRecordProofSchema.parse(
    eligibilityRecordProof,
  ),
};
export const demoEligibilityDirectoryCheckpointHistory =
  publicEligibilityDirectoryCheckpointHistorySchema.parse({
    checkpoints: [eligibilityCheckpoint],
    limit: 256,
    next: null,
  });

export const demoVerificationProofs = {
  "synthetic-eligibility-v3": publicVerificationProofResponseSchema.parse({
    receipt: {
      payload: verificationReceiptPayload,
      attestationToken: syntheticAttestationToken,
    },
    payloadSha256: await canonicalJsonSha256(verificationReceiptPayload),
    verification: {
      valid: true,
      synthetic: true,
      policyId: conformanceDemoProfile.qualification.policyId,
    },
    attestationSummary: {
      issuer: "https://attestation.example.test",
      audience: "https://platform.example.test/verification",
      subject: "synthetic-reference-workload",
      imageDigest: "sha256:synthetic-reference-image",
      swName: "synthetic-confidential-workload",
      debugStatus: "disabled",
      serviceAccounts: ["reference@example.test"],
    },
    limitation:
      "Synthetic demonstration only; this object does not attest a real person or workload.",
  }),
};

export const demoVoteProofs = {
  "synthetic-vote-v3": publicVoteProofResponseSchema.parse({
    bundle: demoVoteProofBundleV3,
    verification: {
      valid: true,
      synthetic: true,
      protocolVersion: VOTE_EVENT_SCHEMA_V3,
      statusScope: "initial_acceptance_only",
    },
  }),
};

const treeHead = demoVoteProofBundleV3.voteEventTransparency.treeHead;

export const demoQuestionVoteCheckpoints = {
  "question-coastal-access": publicTransparencyCheckpointResponseSchema.parse({
    checkpoint: treeHead,
  }),
};

export const demoTransparencyCheckpoint =
  publicTransparencyCheckpointResponseSchema.parse({
    checkpoint: treeHead,
  });

export const demoTransparencyConsistency =
  publicTransparencyConsistencyResponseSchema.parse({
    firstCheckpoint: treeHead,
    proof: {
      firstTreeSize: treeHead.payload.treeSize,
      secondTreeSize: treeHead.payload.treeSize,
      firstRootHash: treeHead.payload.rootHash,
      secondRootHash: treeHead.payload.rootHash,
      auditPath: [],
    },
    secondCheckpoint: treeHead,
  });

export const demoTransparencyEntries =
  publicTransparencyEntriesResponseSchema.parse({
    entries: [
      {
        entryId: demoVoteProofBundleV3.voteEvent.payload.eventId,
        entryPayloadHash: demoVoteProofBundleV3.voteEvent.payloadSha256,
        entryType: "vote_event",
        integratedAt: "2026-07-01T00:05:02.000Z",
        leafHash: demoVoteProofBundleV3.voteEventTransparency.leafHash,
        leafIndex: demoVoteProofBundleV3.voteEventTransparency.leafIndex,
      },
    ],
    limit: 100,
    next: null,
  });

export const demoTransparencyInclusion =
  publicTransparencyInclusionResponseSchema.parse({
    inclusion: demoVoteProofBundleV3.voteEventTransparency,
  });
