# Jurisdiction-neutral platform frontend

This application is a deployable, read-only frontend for
`@konsensus/public-api`. It renders the selected instance's branding, locales,
routes, public issues, question counts, sources, qualification policy, and
proof links. When enabled by the instance profile, it also renders the complete
current eligibility directory and its per-record verification pages. It never
imports the database or sends authentication cookies.

The default build uses the fictional Aotearoa reference instance. It includes a
small schema-validated API under `/api`, so a fresh deployment is functional
without private services or credentials. Every record and proof is explicitly
synthetic and uses reserved example domains. Selecting an external API disables
the bundled synthetic endpoints, so reference records cannot be confused with
the configured instance. External services use the same unversioned `/api/*`
resource paths; no legacy versioned-route fallback is provided.

## Run and deploy

From the monorepo root:

```sh
bun install
bun --cwd=apps/platform-web run dev
bun --cwd=apps/platform-web run check
```

`next build` produces a standalone-compatible build. A service can run it with
`bun --cwd=apps/platform-web run start`; standard Next.js hosts can deploy the
app directory directly.

Configuration is public build-time configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `KONSENSUS_PUBLIC_API_ORIGIN` | `/api` | Current API base ending in unversioned `/api`. Remote origins must use HTTPS and allow anonymous cross-origin GETs. |
| `KONSENSUS_RELYING_APP_ORIGIN` | unset | HTTPS origin responsible for registration, authentication, and mutations. Configured vote routes redirect here. |
| `KONSENSUS_REQUIRE_SOURCE_BINDING` | `false` | Set to `true` for an official deployment; the build fails unless all source-binding values are valid. |
| `KONSENSUS_PUBLIC_REPOSITORY_URL` | unset | Public HTTPS repository represented by the deployment. |
| `KONSENSUS_RELEASE_SOURCE_SHA` | unset | Exact lowercase 40-hex commit used for the build. |
| `KONSENSUS_RELEASE_BUILD_ID` | unset | URL-safe release/build identity, also used as the Next build ID. |

The frontend API client always uses `credentials: "omit"`. Do not weaken the
write application's origin checks or enable cross-origin credentialed writes.
The normalized API and relying-application values are embedded once by
`next build`; the same object drives the client base, redirects, deployment
manifest, bundled-demo switch, and CSP. A production runtime override that
differs from the embedded value fails closed. Rebuild to change either origin.

Every deployment exposes `/.well-known/source.json`, linked in the footer. An
official build first requires a clean Git checkout, verifies that its `HEAD`
equals the configured source commit, and embeds a deterministic SHA-256 digest
of the tracked-file inventory alongside the repository URL and build identity.
Missing, partial, mismatched, or dirty official source values fail the build.
The inventory digest describes `git ls-files --stage -z`; it is not an artifact
digest. The zero-configuration synthetic demo returns an explicit `unbound`
status and does not claim that its deployment corresponds to a repository.

`/.well-known/deployment.json` is linked beside it. It exposes the exact
canonical instance-profile digest, ID and version, public API origin and
credential mode, relying-application origin/status, locales, and configured
route templates. A clone can compare these non-secret settings with its own
checkout before trusting that it is pointed at the intended service.

Both documents are inspectable claims made by the deployment. Even a
checkout-verified build does not stop a dishonest operator from serving false
values or a different artifact. Release attestations and hosting-provider
provenance must separately connect the served build identity to the public
source commit and artifact.

## Select another instance

[`instance.config.ts`](./instance.config.ts) is the only composition point.
Replace its reference-instance import with a package exporting:

- a validated `InstanceProfileV3` with brand, locales, route templates,
  qualification policy, and opinion-index policy;
- localized frontend messages, theme tokens, and optional featured proof IDs.

The rest of the application remains unchanged. Required routes are `issues`,
`issue` (with `{slug}`), `methodology`, `verification`, and `vote` (with
`{slug}`). Profiles enabling `publicVoterPages` must also provide `voters` and
`voter` (with `{publicVoterId}`). Public vote proofs must use the current
question-scoped V3 bundle;
identity receipts and tally snapshots must likewise declare current V3
schemas. Historical application schemas are not accepted by the shell.

The public API exposes the current directory at `/api/eligibility-directory`,
individual inclusion proofs below that path, checkpoint history at
`/api/eligibility-directory/checkpoints`, and the deterministic accepted-vote
log head at `/api/questions/{id}/vote-checkpoint`.

An external API is the source of truth. The shell validates all received
objects with `@konsensus/public-api`; schema failures are surfaced as an
unavailable public API rather than rendered as trusted records. Source and
proof links remain visible for independent inspection.

## Security boundary

This app is intentionally not an authentication or voting client. Selecting an
instance package does not deploy its qualification providers, signing service,
tally engine, transparency witnesses, or operational infrastructure. Those
services remain independently reviewable adapters behind the relying
application and public API.

`tests/neutral-boundary.test.ts` scans the executable and reference instance for
product-specific packages, environment prefixes, and copy. Configuration and
route tests enforce unversioned HTTPS APIs, same-origin mutation redirects,
localized presentation, and current V3 proof material.
