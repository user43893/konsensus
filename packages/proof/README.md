# `@konsensus/proof`

Portable protocol and cryptographic primitives for question-scoped qualified
voting. The package exposes only the current V3 wire format.

## Current public chain

1. An issuer signs a `qualified-opinion.ballot-manifest.v3`.
2. A private, passkey-authorized request asks an attested eligibility workload
   for one fresh question key.
3. The workload returns a
   `qualified-opinion.question-voting-authorization.v3`. Its Confidential Space
   nonce is the canonical payload digest.
4. That short-lived key signs a `qualified-opinion.vote-event.v3`.
5. The service binds acceptance to the deterministic question log and
   atomically publishes event, receipt, and signed tree-head artifacts.
6. A `qualified-opinion.public-vote-proof-bundle.v3` discloses only the
   question authorization, ballot, event, receipt and inclusion proofs.
7. A signed `qualified-voting.tally-snapshot.v3` carries the complete
   contiguous question-log prefix and supports deterministic replay.

Names, email addresses, public voter IDs, registration proofs, reusable
credentials and root delegations are excluded from public vote proofs and tally
inputs. Optional attribution is a separate, removable signed V3 artifact.

## Main APIs

- `buildProtocolBindingV3`, `buildBallotManifestV3`
- `buildIdentityAttestationPolicyV3`, `buildEligibilityAssertionV3`
- `buildQuestionVotingAuthorizationRequestV3`
- `buildQuestionVotingAuthorizationPayloadV3`,
  `buildQuestionVotingAuthorizationV3`
- `buildVoteEventV3`, `buildVoteAcceptanceV3`,
  `buildVoteAdjudicationV3`
- `buildPublicVoteProofBundleV3`,
  `verifyPublicVoteProofBundleV3Integrity`
- `questionVoteLogIdV3`
- `buildTallyInputSetV3`, `buildTallySnapshotV3`, `replayTallyV3`
- `buildPublicVoteAttributionPayloadV3`

`@konsensus/proof/node` additionally exposes P-256, Ed25519 and WebAuthn
verification plus full V3 tally cryptographic verification.

Canonical JSON follows RFC 8785-compatible I-JSON constraints. Transparency
trees and inclusion/consistency proofs use the RFC 6962 hash construction.

## Development

```bash
bun test
bun run typecheck
```
