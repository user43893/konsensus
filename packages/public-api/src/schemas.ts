import {
  type ActiveEligibilityDirectoryBundleV3,
  type ActiveEligibilityDirectoryCheckpointV3,
  type ActiveEligibilityDirectoryRecordProofV3,
  type PublicVoteProofBundleV3,
  type SignedPayload,
  type TallyInputSetV3,
  type TallySnapshotV3,
  assertActiveEligibilityDirectoryBundleV3,
  assertActiveEligibilityDirectoryCheckpointV3,
  assertActiveEligibilityDirectoryRecordProofV3,
  assertTallyInputSetV3,
  assertTallySnapshotV3,
  validatePublicVoteProofBundleV3,
} from "@konsensus/proof";
import { z } from "zod";

/** Current public resources are intentionally unversioned at the HTTP layer. */
export const PUBLIC_API_PATHS = {
  eligibilityDirectory: "/api/eligibility-directory",
  eligibilityDirectoryCheckpoints: "/api/eligibility-directory/checkpoints",
  eligibilityDirectoryRecord: "/api/eligibility-directory/{publicVoterId}",
  issues: "/api/issues",
  issue: "/api/issues/{slug}",
  issueQuestions: "/api/issues/{slug}/questions",
  questionCounts: "/api/questions/{id}/counts",
  questionVoteCheckpoint: "/api/questions/{id}/vote-checkpoint",
  dataExport: "/api/data/{kind}",
  verificationProof: "/api/verification-proofs/{proofId}",
  voteProof: "/api/vote-proofs/{id}",
  tallySnapshot: "/api/tally-snapshots/{id}",
  transparencyCheckpoint: "/api/transparency/checkpoint",
  transparencyConsistency: "/api/transparency/consistency",
  transparencyEntries: "/api/transparency/entries",
  transparencyInclusion: "/api/transparency/inclusion",
} as const;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const jsonObjectSchema = z.record(jsonValueSchema);

const identifierSchema = z.string().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const finiteNumberSchema = z.number().finite();
export const publicAbsoluteHttpUrlSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (
      !/^https?:\/\//i.test(value) ||
      value.trim() !== value ||
      containsAsciiControl(value)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be an absolute HTTP(S) URL",
      });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be an absolute HTTP(S) URL",
      });
      return;
    }
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hostname === ""
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be a credential-free absolute HTTP(S) URL",
      });
    }
  });

function containsAsciiControl(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 0x20 || codePoint === 0x7f;
  });
}

const numericJsonSchema = z
  .union([finiteNumberSchema, z.string().regex(/^-?(?:\d+|\d*\.\d+)$/)])
  .transform((value) => Number(value));

const zonedDateTimeStringSchema = z.string().refine((value) => {
  if (
    value.trim() !== value ||
    containsAsciiControl(value) ||
    !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value)
  ) {
    return false;
  }
  return Number.isFinite(new Date(value).getTime());
}, "must be a timestamp with an explicit UTC offset");

export const jsonDateTimeSchema = z
  .union([z.date(), zonedDateTimeStringSchema])
  .transform((value) => new Date(value).toISOString());

export const nullableJsonDateTimeSchema = jsonDateTimeSchema.nullable();

export const publicIssueSchema = z.object({
  id: identifierSchema,
  slug: identifierSchema,
  title: z.string(),
  shortTitle: z.string().nullable(),
  summary: z.string(),
  plainLanguageSummary: z.string(),
  countryCode: z.string().min(2).max(3),
  jurisdictionLabel: z.string(),
  status: identifierSchema,
  openedAt: nullableJsonDateTimeSchema,
  closedAt: nullableJsonDateTimeSchema,
  currentStatusText: z.string(),
  updatedAt: jsonDateTimeSchema,
});

export const publicQuestionChoiceCountSchema = z.object({
  id: identifierSchema,
  legalQuestionId: identifierSchema,
  slug: identifierSchema,
  label: z.string(),
  displayOrder: z.number().int(),
  isCounted: z.boolean(),
  count: nonNegativeIntegerSchema,
  percentage: finiteNumberSchema,
  rawPercentage: finiteNumberSchema,
  scorePercentage: finiteNumberSchema,
});

export const publicQuestionCountsSchema = z.object({
  legalQuestionId: identifierSchema,
  totalCount: nonNegativeIntegerSchema,
  directVoteCount: nonNegativeIntegerSchema,
  publicStatementCount: nonNegativeIntegerSchema,
  disputedCount: nonNegativeIntegerSchema,
  choices: z.array(publicQuestionChoiceCountSchema),
});

export const publicQuestionSchema = z.object({
  id: identifierSchema,
  issueId: identifierSchema,
  proceedingId: identifierSchema.nullable(),
  decisionId: identifierSchema.nullable(),
  slug: identifierSchema,
  questionText: z.string(),
  plainLanguageText: z.string().nullable(),
  questionType: identifierSchema,
  status: identifierSchema,
  displayOrder: z.number().int(),
  countPolicy: identifierSchema,
  publishedAt: jsonDateTimeSchema,
  closedAt: nullableJsonDateTimeSchema,
  supersedesQuestionId: identifierSchema.nullable(),
  updatedAt: jsonDateTimeSchema,
});

export const publicQuestionWithCountsSchema = publicQuestionSchema.extend({
  counts: publicQuestionCountsSchema,
});

export const publicMatterSchema = z.object({
  id: identifierSchema,
  slug: identifierSchema,
  name: z.string(),
  description: z.string(),
  parentMatterId: identifierSchema.nullable(),
  status: identifierSchema,
  updatedAt: jsonDateTimeSchema,
});

export const publicEventSchema = z.object({
  id: identifierSchema,
  issueId: identifierSchema,
  proceedingId: identifierSchema.nullable(),
  eventType: identifierSchema,
  title: z.string(),
  summary: z.string(),
  occurredAt: nullableJsonDateTimeSchema,
  occurredDatePrecision: identifierSchema,
  actorName: z.string().nullable(),
  actorType: z.string().nullable(),
  importance: z.number().int(),
  updatedAt: jsonDateTimeSchema,
});

export const publicProceedingSchema = z.object({
  id: identifierSchema,
  issueId: identifierSchema,
  parentProceedingId: identifierSchema.nullable(),
  proceedingType: identifierSchema,
  bodyName: z.string(),
  bodyType: identifierSchema,
  caseNumber: z.string().nullable(),
  jurisdictionLevel: identifierSchema,
  countryCode: z.string().min(2).max(3),
  city: z.string().nullable(),
  partiesSummary: z.string(),
  status: identifierSchema,
  startedAt: nullableJsonDateTimeSchema,
  endedAt: nullableJsonDateTimeSchema,
  updatedAt: jsonDateTimeSchema,
});

export const publicDecisionSchema = z.object({
  id: identifierSchema,
  issueId: identifierSchema,
  proceedingId: identifierSchema.nullable(),
  eventId: identifierSchema.nullable(),
  decisionType: identifierSchema,
  decisionTitle: z.string(),
  decisionSummary: z.string(),
  bodyName: z.string(),
  decisionDate: nullableJsonDateTimeSchema,
  decisionDatePrecision: identifierSchema,
  outcomeSummary: z.string(),
  legalEffectSummary: z.string(),
  finalityStatus: identifierSchema,
  appealStatus: z.string().nullable(),
  enforcementStatus: z.string().nullable(),
  updatedAt: jsonDateTimeSchema,
});

export const publicSourceSchema = z.object({
  id: identifierSchema,
  sourceType: identifierSchema,
  url: publicAbsoluteHttpUrlSchema.nullable(),
  canonicalUrl: publicAbsoluteHttpUrlSchema.nullable(),
  archiveUrl: publicAbsoluteHttpUrlSchema.nullable(),
  title: z.string(),
  publisher: z.string().nullable(),
  authorText: z.string().nullable(),
  languageCode: identifierSchema,
  publishedAt: nullableJsonDateTimeSchema,
  capturedAt: nullableJsonDateTimeSchema,
  sourceStatus: identifierSchema,
  summary: z.string().nullable(),
  updatedAt: jsonDateTimeSchema,
});

export const publicIssueListItemSchema = publicIssueSchema.extend({
  questionCount: nonNegativeIntegerSchema,
  matterNames: z.array(z.string()),
  matterSlugs: z.array(z.string()),
  positionCount: nonNegativeIntegerSchema,
  sourceCount: nonNegativeIntegerSchema,
  imagePath: z.string().nullable(),
  firstTimelineEventAt: nullableJsonDateTimeSchema,
  latestTimelineEventAt: nullableJsonDateTimeSchema,
  headlineQuestion: z
    .object({
      id: identifierSchema,
      slug: identifierSchema,
      questionText: z.string(),
    })
    .nullable(),
  headlineCounts: publicQuestionCountsSchema.nullable(),
});

export const publicIssueOverviewSchema = z.object({
  issue: publicIssueSchema,
  matters: z.array(publicMatterSchema),
  questions: z.array(publicQuestionWithCountsSchema),
  events: z.array(publicEventSchema),
  proceedings: z.array(publicProceedingSchema),
  decisions: z.array(publicDecisionSchema),
  sources: z.array(publicSourceSchema),
});

export const publicIssueListResponseSchema = z.object({
  issues: z.array(publicIssueListItemSchema),
});

export const publicIssueQuestionsResponseSchema = z.object({
  issue: publicIssueSchema,
  questions: z.array(publicQuestionWithCountsSchema),
});

export const publicChoiceSchema = z.object({
  id: identifierSchema,
  legalQuestionId: identifierSchema,
  slug: identifierSchema,
  label: z.string(),
  shortLabel: z.string().nullable(),
  description: z.string(),
  semanticCode: z.string().nullable(),
  displayOrder: z.number().int(),
  isCounted: z.boolean(),
  isDefaultUnclear: z.boolean(),
});

export const publicSnapshotSchema = z.object({
  id: identifierSchema,
  issueId: identifierSchema,
  legalQuestionId: identifierSchema,
  snapshotAt: jsonDateTimeSchema,
  calculationVersion: identifierSchema,
  totalCount: nonNegativeIntegerSchema,
  directVoteCount: nonNegativeIntegerSchema,
  publicStatementCount: nonNegativeIntegerSchema,
  disputedCount: nonNegativeIntegerSchema,
});

export const publicSnapshotChoiceCountSchema = z.object({
  id: identifierSchema,
  snapshotId: identifierSchema,
  choiceId: identifierSchema,
  count: nonNegativeIntegerSchema,
  percentage: numericJsonSchema,
});

export const publicPositionSchema = z.object({
  id: identifierSchema,
  legalQuestionId: identifierSchema,
  choiceId: identifierSchema,
  positionType: identifierSchema,
  positionDate: nullableJsonDateTimeSchema,
  positionDatePrecision: identifierSchema,
  status: z.literal("counted"),
  countWeight: numericJsonSchema,
  confidence: numericJsonSchema.nullable(),
  visibility: z.literal("public"),
  updatedAt: jsonDateTimeSchema,
});

export const publicStatementSchema = z.object({
  id: identifierSchema,
  sourceId: identifierSchema.nullable(),
  issueId: identifierSchema,
  statementExcerpt: z.string().nullable(),
  statementLanguageCode: identifierSchema,
  statementDate: nullableJsonDateTimeSchema,
  statementDatePrecision: identifierSchema,
});

const paginationSchema = {
  limit: z.number().int().min(1).max(100),
  offset: nonNegativeIntegerSchema,
  total: nonNegativeIntegerSchema,
};

export const issueDataExportResponseSchema = z.object({
  issues: z.array(publicIssueSchema),
  ...paginationSchema,
});

export const questionDataExportResponseSchema = z.object({
  questions: z.array(publicQuestionSchema),
  choices: z.array(publicChoiceSchema),
  ...paginationSchema,
});

export const snapshotDataExportResponseSchema = z.object({
  snapshots: z.array(publicSnapshotSchema),
  snapshotChoiceCounts: z.array(publicSnapshotChoiceCountSchema),
  ...paginationSchema,
});

export const publicPositionDataExportResponseSchema = z.object({
  positions: z.array(
    z.object({
      position: publicPositionSchema,
      statement: publicStatementSchema.nullable(),
      source: publicSourceSchema,
      choice: publicChoiceSchema,
    }),
  ),
  ...paginationSchema,
});

export const publicDataExportSchemas = {
  issues: issueDataExportResponseSchema,
  questions: questionDataExportResponseSchema,
  snapshots: snapshotDataExportResponseSchema,
  "public-positions": publicPositionDataExportResponseSchema,
} as const;

export type PublicDataExportKind = keyof typeof publicDataExportSchemas;
export type PublicDataExportResponse<K extends PublicDataExportKind> = z.output<
  (typeof publicDataExportSchemas)[K]
>;

const currentProtocolObjectSchema = jsonObjectSchema.superRefine(
  (value, context) => {
    if (typeof value.schema !== "string" || !value.schema.endsWith(".v3")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "proof payload must declare a current V3 schema",
        path: ["schema"],
      });
    }
  },
);

const publicVoteProofBundleV3Schema = z.custom<PublicVoteProofBundleV3>(
  (value) => validatePublicVoteProofBundleV3(value).ok,
  "bundle must be a current V3 public vote proof",
);

const tallyInputSetV3Schema = z.custom<TallyInputSetV3>((value) => {
  try {
    assertTallyInputSetV3(value);
    return true;
  } catch {
    return false;
  }
}, "inputSet must be a current V3 tally input set");

const tallySnapshotV3Schema = z.custom<TallySnapshotV3>((value) => {
  try {
    assertTallySnapshotV3(value);
    return true;
  } catch {
    return false;
  }
}, "snapshot must be a current V3 tally snapshot");

function exactCurrentProtocol<T>(
  assertion: (value: unknown) => asserts value is T,
  message: string,
) {
  return z.custom<T>((value) => {
    try {
      assertion(value);
      return true;
    } catch {
      return false;
    }
  }, message);
}

export const publicEligibilityDirectoryBundleSchema =
  exactCurrentProtocol<ActiveEligibilityDirectoryBundleV3>(
    assertActiveEligibilityDirectoryBundleV3,
    "directory must be a current V3 active-eligibility bundle",
  );

export const publicEligibilityDirectoryRecordProofSchema =
  exactCurrentProtocol<ActiveEligibilityDirectoryRecordProofV3>(
    assertActiveEligibilityDirectoryRecordProofV3,
    "record must be a current V3 active-eligibility proof",
  );

const publicEligibilityDirectoryCheckpointSchema = exactCurrentProtocol<
  SignedPayload<ActiveEligibilityDirectoryCheckpointV3>
>(
  (
    value,
  ): asserts value is SignedPayload<ActiveEligibilityDirectoryCheckpointV3> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("checkpoint envelope must be an object");
    }
    const envelope = value as Record<string, unknown>;
    if (
      Object.keys(envelope).sort().join(",") !==
      "payload,payloadSha256,signature"
    ) {
      throw new TypeError("checkpoint envelope fields are invalid");
    }
    assertActiveEligibilityDirectoryCheckpointV3(envelope.payload);
    if (
      typeof envelope.payloadSha256 !== "string" ||
      !envelope.signature ||
      typeof envelope.signature !== "object" ||
      Array.isArray(envelope.signature)
    ) {
      throw new TypeError("checkpoint envelope signature is invalid");
    }
  },
  "checkpoint must be a current V3 active-eligibility checkpoint",
);

export const publicEligibilityDirectoryCheckpointHistorySchema = z.object({
  checkpoints: z.array(publicEligibilityDirectoryCheckpointSchema),
  limit: z.number().int().min(1).max(256),
  next: z.number().int().positive().nullable(),
});

export const publicVerificationProofResponseSchema = z.object({
  receipt: z.object({
    payload: currentProtocolObjectSchema,
    attestationToken: z.string().min(1),
  }),
  payloadSha256: z.string().min(1),
  // Qualification details are instance policy. Their signed status fields stay
  // available without making one jurisdiction's registry model part of the
  // neutral API contract.
  verification: jsonObjectSchema,
  attestationSummary: z.object({
    issuer: z.string().nullable(),
    audience: z.string().nullable(),
    subject: z.string().nullable(),
    imageDigest: z.string().nullable(),
    swName: z.string().nullable(),
    debugStatus: z.string().nullable(),
    serviceAccounts: z.array(z.string()),
  }),
  limitation: z.string(),
});

export const publicVoteProofResponseSchema = z.object({
  bundle: publicVoteProofBundleV3Schema,
  verification: jsonObjectSchema,
});

export const publicTallySnapshotResponseSchema = z.object({
  inputSet: tallyInputSetV3Schema,
  snapshot: tallySnapshotV3Schema,
});

export const publicTransparencyCheckpointResponseSchema = z.object({
  checkpoint: jsonObjectSchema,
});

export const publicTransparencyConsistencyResponseSchema = jsonObjectSchema;

export const publicTransparencyEntriesResponseSchema = z.object({
  entries: z.array(jsonObjectSchema),
  limit: nonNegativeIntegerSchema,
  next: nonNegativeIntegerSchema.nullable(),
});

export const publicTransparencyInclusionResponseSchema = z.object({
  inclusion: jsonObjectSchema,
});

export const publicApiErrorSchema = z.object({
  error: z.string().min(1),
});

export type PublicIssue = z.output<typeof publicIssueSchema>;
export type PublicEligibilityDirectoryBundle = z.output<
  typeof publicEligibilityDirectoryBundleSchema
>;
export type PublicEligibilityDirectoryCheckpointHistory = z.output<
  typeof publicEligibilityDirectoryCheckpointHistorySchema
>;
export type PublicEligibilityDirectoryRecordProof = z.output<
  typeof publicEligibilityDirectoryRecordProofSchema
>;
export type PublicIssueListItem = z.output<typeof publicIssueListItemSchema>;
export type PublicIssueListResponse = z.output<
  typeof publicIssueListResponseSchema
>;
export type PublicIssueOverview = z.output<typeof publicIssueOverviewSchema>;
export type PublicIssueQuestionsResponse = z.output<
  typeof publicIssueQuestionsResponseSchema
>;
export type PublicQuestion = z.output<typeof publicQuestionSchema>;
export type PublicQuestionCounts = z.output<typeof publicQuestionCountsSchema>;
export type PublicVerificationProofResponse = z.output<
  typeof publicVerificationProofResponseSchema
>;
export type PublicVoteProofResponse = z.output<
  typeof publicVoteProofResponseSchema
>;
export type PublicTallySnapshotResponse = z.output<
  typeof publicTallySnapshotResponseSchema
>;
