import { demoDataExports } from "@konsensus/instance-conformance-demo/public-data";
import {
  demoApiJson,
  demoApiNotFound,
  demoApiOptions,
} from "../../../../lib/demo-api";

type RouteContext = { params: Promise<{ kind: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { kind } = await context.params;
  if (!Object.hasOwn(demoDataExports, kind)) return demoApiNotFound();
  return demoApiJson(demoDataExports[kind as keyof typeof demoDataExports]);
}

export const OPTIONS = demoApiOptions;
