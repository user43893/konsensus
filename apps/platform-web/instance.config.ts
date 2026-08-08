import {
  conformanceDemoFrontend,
  conformanceDemoProfile,
} from "@konsensus/instance-conformance-demo";
import {
  definePlatformFrontendConfig,
  deploymentSettingsForRuntime,
} from "./lib/config";

const deployment = deploymentSettingsForRuntime({
  ...process.env,
  KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS:
    process.env.KONSENSUS_EMBEDDED_DEPLOYMENT_SETTINGS,
});

/**
 * This is the only instance composition point in the executable shell.
 * Replace the reference package to ship another jurisdiction; use build-time
 * variables to point the resulting immutable build at its public API and
 * relying application.
 */
export const platformConfig = definePlatformFrontendConfig({
  profile: conformanceDemoProfile,
  ...deployment,
  ...conformanceDemoFrontend,
});
