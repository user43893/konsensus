# Instance packages

An instance package contains stable public policy and presentation consumed by
the platform adapters. It must contain no credentials, mutable provider state,
private qualification evidence, or signing keys.

`conformance-demo` is a deliberately synthetic, deployable reference instance.
It supplies a profile, localized presentation, and schema-validated fictional
API records to `apps/platform-web`. Its synthetic current eligibility directory
and deterministic question log exercise the same read surfaces as an external
instance. All identities and domains are reserved examples.

Profiles are content-addressed into the protocol binding. Updating one requires
a policy and release review. The reference frontend is a deployable read-only
shell; deploying qualification, voting, tally, or witness services requires
separate adapters and an explicit security review.
