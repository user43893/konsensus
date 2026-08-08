import { demoEligibilityDirectoryRecordProofs } from "@konsensus/instance-conformance-demo/public-data";
import {
  demoApiJson,
  demoApiNotFound,
  demoApiOptions,
} from "../../../../lib/demo-api";

type RouteContext = { params: Promise<{ publicVoterId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { publicVoterId } = await context.params;
  const proof =
    demoEligibilityDirectoryRecordProofs[
      publicVoterId as keyof typeof demoEligibilityDirectoryRecordProofs
    ];
  return proof ? demoApiJson(proof) : demoApiNotFound();
}

export const OPTIONS = demoApiOptions;
