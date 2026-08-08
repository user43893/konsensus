import { platformConfig } from "../../../instance.config";
import { buildFrontendDeploymentManifest } from "../../../lib/deployment-manifest";
import { frontendSourceBindingForRuntime } from "../../../lib/source-binding";

const responseHeaders = {
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control":
    "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
} as const;

export async function GET() {
  const environment = {
    ...process.env,
    KONSENSUS_EMBEDDED_SOURCE_BINDING:
      process.env.KONSENSUS_EMBEDDED_SOURCE_BINDING,
  };
  const manifest = await buildFrontendDeploymentManifest({
    profile: platformConfig.profile,
    publicApiOrigin: platformConfig.publicApiOrigin,
    relyingApplicationOrigin: platformConfig.relyingApplicationOrigin,
    sourceBinding: frontendSourceBindingForRuntime(environment),
  });
  return Response.json(manifest, { headers: responseHeaders });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: responseHeaders });
}
