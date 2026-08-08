import { frontendSourceBindingForRuntime } from "../../../lib/source-binding";

const responseHeaders = {
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control":
    "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
} as const;

export function GET() {
  const environment = {
    ...process.env,
    KONSENSUS_EMBEDDED_SOURCE_BINDING:
      process.env.KONSENSUS_EMBEDDED_SOURCE_BINDING,
  };
  return Response.json(frontendSourceBindingForRuntime(environment), {
    headers: responseHeaders,
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: responseHeaders });
}
