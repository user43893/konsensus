# `@konsensus/public-api`

Jurisdiction-neutral schemas, types, endpoint templates, and a browser/Node
fetch client for the current unversioned public read API exposed by
qualified-opinion instances.

The contract is deliberately read-only. It never sends cookies and does not
model authentication, qualification, voting, administration, or any other
mutation. Instance frontends can therefore use it against their own deployment
or another compatible instance without weakening the origin boundary around
those operations.

```ts
import { PublicApiClient } from "@konsensus/public-api";

const api = new PublicApiClient({
  baseUrl: "https://example.org/api",
});

const { issues } = await api.listIssues({ q: "coastal access" });
const issue = await api.getIssue(issues[0].slug);
const directory = await api.getEligibilityDirectory();
const record = await api.getEligibilityDirectoryRecord(
  directory.records[0].publicVoterId,
);
```

The current HTTP resources live directly below `/api`; versioned compatibility
routes are not part of this contract. Vote-proof and tally responses must carry
structurally valid V3 protocol objects. A dedicated verifier must still check
signatures, independently pinned trust policy, attestation, and current
publication state.

Eligibility-directory responses use the exact current V3 bundle and record
proof schemas. Checkpoint history permits an independent monitor to follow the
mutable current set, while each question's vote-checkpoint endpoint exposes the
head of its deterministic, question-scoped accepted-vote log.

Issue-list responses use the current `{ "issues": [...] }` collection shape.
Source-link fields accept only absolute, credential-free `http:` or `https:`
URLs (or `null`) at the schema boundary.
