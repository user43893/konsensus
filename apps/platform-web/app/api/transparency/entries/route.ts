import { demoTransparencyEntries } from "@konsensus/instance-conformance-demo/public-data";
import { demoApiJson, demoApiOptions } from "../../../../lib/demo-api";

export function GET() {
  return demoApiJson(demoTransparencyEntries);
}

export const OPTIONS = demoApiOptions;
