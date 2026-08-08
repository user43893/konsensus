import type { NextConfig } from "next";
import {
  createEmbeddedDeploymentSettings,
  resolveDeploymentSettings,
} from "./lib/config";
import { resolveFrontendSourceBinding } from "./lib/source-binding";
import { inspectGitSourceCheckout } from "./lib/source-checkout";

const deploymentSettings = resolveDeploymentSettings(process.env);
const embeddedDeploymentSettings =
  createEmbeddedDeploymentSettings(deploymentSettings);
const apiOrigin = deploymentSettings.publicApiOrigin;
const connectSource = apiOrigin.startsWith("/")
  ? ""
  : ` ${new URL(apiOrigin).origin}`;
const developmentConnectSource =
  process.env.NODE_ENV === "development" ? " ws:" : "";
const developmentScriptSource =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const sourceBinding = resolveFrontendSourceBinding(
  process.env,
  inspectGitSourceCheckout,
);

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: `base-uri 'self'; connect-src 'self'${connectSource}${developmentConnectSource}; default-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; object-src 'none'; script-src 'self' 'unsafe-inline'${developmentScriptSource}; style-src 'self' 'unsafe-inline'`,
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

const nextConfig: NextConfig = {
  env: {
    KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS: JSON.stringify(
      embeddedDeploymentSettings,
    ),
    KONSENSUS_EMBEDDED_SOURCE_BINDING: JSON.stringify(sourceBinding),
  },
  ...(sourceBinding.status === "bound"
    ? { generateBuildId: async () => sourceBinding.buildId }
    : {}),
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: [
    "@konsensus/instance-conformance-demo",
    "@konsensus/instance-profile",
    "@konsensus/proof",
    "@konsensus/public-api",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Headers",
            value: "Accept, Content-Type",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, HEAD, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
