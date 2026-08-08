import {
  INSTANCE_PROFILE_SCHEMA_V3,
  defineInstanceProfile,
} from "@konsensus/instance-profile";

/**
 * Synthetic current-protocol policy for the deployable reference instance.
 * Names, records, and qualification evidence are fictional and use reserved
 * example domains.
 */
export const conformanceDemoProfile = defineInstanceProfile({
  schema: INSTANCE_PROFILE_SCHEMA_V3,
  id: "example.nz.open-law",
  version: "3.0.0",
  brand: {
    name: "Open Law Aotearoa",
    shortDescription: "A synthetic qualified legal-opinion index",
    contactEmail: "maintainer@example.test",
  },
  jurisdiction: {
    countryCode: "NZ",
    name: "Aotearoa New Zealand",
  },
  locales: {
    default: "en-NZ",
    supported: ["en-NZ", "mi-NZ"],
  },
  routes: {
    issue: "/questions/{slug}",
    issues: "/questions",
    methodology: "/how-it-works",
    voter: "/participants/{publicVoterId}",
    voters: "/participants",
    verification: "/verify",
    vote: "/questions/{slug}/respond",
  },
  qualification: {
    policyId: "example-nz-law-graduate-v3",
    issuer: "example.nz.open-law",
    subjectIssuer: "example.nz.university-registry",
    subjectKeyScheme: "example.university-alumni-subject.v3",
    publicIdentity: true,
    evidenceTypes: [
      "qualified-opinion.email-control-passkey.v3",
      "qualified-opinion.eligibility-assertion.v3",
    ],
  },
  opinionIndex: {
    policyId: "one-qualified-person-one-vote-v3",
    groups: [{ id: "qualified-person", weight: "1/1" }],
    depthThresholds: {
      main: 3,
      secondary: 3,
    },
    directVotePrecedence: "separate_channels",
  },
  features: {
    directVoting: true,
    sourcedOpinions: false,
    publicVoterPages: true,
  },
});
