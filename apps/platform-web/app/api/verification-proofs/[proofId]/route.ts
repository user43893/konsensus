import { demoVerificationProofs } from "@konsensus/instance-conformance-demo/public-data";
import {
  demoApiJson,
  demoApiNotFound,
  demoApiOptions,
} from "../../../../lib/demo-api";

type RouteContext = { params: Promise<{ proofId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { proofId } = await context.params;
  const proof =
    demoVerificationProofs[proofId as keyof typeof demoVerificationProofs];
  return proof ? demoApiJson(proof) : demoApiNotFound();
}

export const OPTIONS = demoApiOptions;
