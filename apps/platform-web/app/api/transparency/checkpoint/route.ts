import { demoTransparencyCheckpoint } from "@konsensus/instance-conformance-demo/public-data";
import { demoApiJson, demoApiOptions } from "../../../../lib/demo-api";

export function GET() {
  return demoApiJson(demoTransparencyCheckpoint);
}

export const OPTIONS = demoApiOptions;
