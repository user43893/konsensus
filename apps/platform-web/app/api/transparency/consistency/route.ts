import { demoTransparencyConsistency } from "@konsensus/instance-conformance-demo/public-data";
import { demoApiJson, demoApiOptions } from "../../../../lib/demo-api";

export function GET() {
  return demoApiJson(demoTransparencyConsistency);
}

export const OPTIONS = demoApiOptions;
