import {
  type InstanceProfileV3,
  instanceProfileSha256,
} from "@konsensus/instance-profile";
import type { FrontendSourceBinding } from "./source-binding";

export const FRONTEND_DEPLOYMENT_MANIFEST_SCHEMA_V3 =
  "qualified-opinion.frontend-deployment.v3" as const;

export type FrontendDeploymentManifest = {
  schema: typeof FRONTEND_DEPLOYMENT_MANIFEST_SCHEMA_V3;
  sourceBinding: {
    href: "/.well-known/source.json";
    status: FrontendSourceBinding["status"];
  };
  instance: {
    id: string;
    version: string;
    profileDigest: {
      algorithm: "sha-256";
      encoding: "base64url";
      canonicalization: "canonical-json";
      value: string;
    };
    defaultLocale: string;
    supportedLocales: readonly string[];
    routes: Readonly<Record<string, string>>;
  };
  publicApi: {
    origin: string;
    pathStyle: "unversioned-current";
    credentials: "omit";
    mode: "bundled-reference" | "external";
  };
  relyingApplication:
    | {
        status: "configured";
        origin: string;
        mutationHandling: "redirect";
      }
    | {
        status: "not-configured";
        origin: null;
        mutationHandling: "disabled";
      };
  limitation: string;
};

export async function buildFrontendDeploymentManifest(input: {
  profile: InstanceProfileV3;
  publicApiOrigin: string;
  relyingApplicationOrigin: string | null;
  sourceBinding: FrontendSourceBinding;
}): Promise<FrontendDeploymentManifest> {
  return {
    schema: FRONTEND_DEPLOYMENT_MANIFEST_SCHEMA_V3,
    sourceBinding: {
      href: "/.well-known/source.json",
      status: input.sourceBinding.status,
    },
    instance: {
      id: input.profile.id,
      version: input.profile.version,
      profileDigest: {
        algorithm: "sha-256",
        encoding: "base64url",
        canonicalization: "canonical-json",
        value: await instanceProfileSha256(input.profile),
      },
      defaultLocale: input.profile.locales.default,
      supportedLocales: input.profile.locales.supported,
      routes: input.profile.routes,
    },
    publicApi: {
      origin: input.publicApiOrigin,
      pathStyle: "unversioned-current",
      credentials: "omit",
      mode: input.publicApiOrigin.startsWith("/")
        ? "bundled-reference"
        : "external",
    },
    relyingApplication: input.relyingApplicationOrigin
      ? {
          status: "configured",
          origin: input.relyingApplicationOrigin,
          mutationHandling: "redirect",
        }
      : {
          status: "not-configured",
          origin: null,
          mutationHandling: "disabled",
        },
    limitation:
      "This is inspectable deployment configuration, not independent proof that the operator served code from the claimed source. Verify release and hosting-provider provenance separately.",
  };
}
