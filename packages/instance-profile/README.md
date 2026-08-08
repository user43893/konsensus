# `@konsensus/instance-profile`

This package validates, freezes, canonicalizes, and hashes the stable public
policy of a qualified-opinion instance.

`InstanceProfileV3` covers instance identity/version, brand metadata,
jurisdiction, locales, route templates, qualification issuer and evidence
types, exact rational tally groups, display-depth thresholds, direct-vote
precedence, and feature policy. The hash is suitable for a protocol binding, so
a profile update is a signed policy change rather than an untracked theme edit.

```ts
import {
  INSTANCE_PROFILE_SCHEMA_V3,
  defineInstanceProfile,
  instanceProfileSha256,
} from "@konsensus/instance-profile";

const profile = defineInstanceProfile({
  schema: INSTANCE_PROFILE_SCHEMA_V3,
  id: "example.org.qualified-opinions",
  version: "3.0.0",
  brand: {
    name: "Qualified Opinions",
    shortDescription: "A public qualified-opinion index",
    contactEmail: "maintainer@example.org",
  },
  jurisdiction: { countryCode: "NZ", name: "Aotearoa New Zealand" },
  locales: { default: "en-NZ", supported: ["en-NZ"] },
  routes: {
    issues: "/questions",
    issue: "/questions/{slug}",
    vote: "/questions/{slug}/respond",
    verification: "/verify",
  },
  qualification: {
    policyId: "example-qualified-person-v3",
    issuer: "example.org.qualified-opinions",
    subjectIssuer: "example.org.public-registry",
    subjectKeyScheme: "example.org.registry-subject.v3",
    publicIdentity: false,
    evidenceTypes: ["public-registry-record"],
  },
  opinionIndex: {
    policyId: "one-qualified-person-one-vote-v3",
    groups: [{ id: "qualified-person", weight: "1/1" }],
    depthThresholds: { main: 3, secondary: 10 },
    directVotePrecedence: "separate_channels",
  },
  features: {
    directVoting: true,
    sourcedOpinions: false,
    publicVoterPages: false,
  },
});

const policyHash = await instanceProfileSha256(profile);
```

The profile does not configure localized UI copy, database schemas,
qualification-provider behavior, infrastructure, or release trust roots.
