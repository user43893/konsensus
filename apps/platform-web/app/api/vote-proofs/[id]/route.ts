import { demoVoteProofs } from "@konsensus/instance-conformance-demo/public-data";
import {
  demoApiJson,
  demoApiNotFound,
  demoApiOptions,
} from "../../../../lib/demo-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const proof = demoVoteProofs[id as keyof typeof demoVoteProofs];
  return proof ? demoApiJson(proof) : demoApiNotFound();
}

export const OPTIONS = demoApiOptions;
