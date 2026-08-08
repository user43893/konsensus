import { demoTransparencyInclusion } from "@konsensus/instance-conformance-demo/public-data";
import { demoApiJson, demoApiOptions } from "../../../../lib/demo-api";

export function GET() {
  return demoApiJson(demoTransparencyInclusion);
}

export const OPTIONS = demoApiOptions;
