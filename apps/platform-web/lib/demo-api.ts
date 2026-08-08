import { deploymentSettingsForRuntime } from "./config";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
} as const;

export function demoApiJson(body: unknown, status = 200) {
  if (!bundledDemoApiEnabled(runtimeDeploymentEnvironment())) {
    return Response.json({ error: "bundled_demo_disabled" }, { status: 404 });
  }
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

export function demoApiNotFound() {
  return demoApiJson({ error: "not_found" }, 404);
}

export function demoApiOptions() {
  if (!bundledDemoApiEnabled(runtimeDeploymentEnvironment())) {
    return Response.json({ error: "bundled_demo_disabled" }, { status: 404 });
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function bundledDemoApiEnabled(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return deploymentSettingsForRuntime(environment).publicApiOrigin.startsWith(
    "/",
  );
}

function runtimeDeploymentEnvironment() {
  return {
    ...process.env,
    KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS:
      process.env.KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS,
  };
}
