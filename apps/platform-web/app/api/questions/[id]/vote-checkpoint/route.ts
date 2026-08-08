import { demoQuestionVoteCheckpoints } from "@konsensus/instance-conformance-demo/public-data";
import {
  demoApiJson,
  demoApiNotFound,
  demoApiOptions,
} from "../../../../../lib/demo-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const checkpoint =
    demoQuestionVoteCheckpoints[id as keyof typeof demoQuestionVoteCheckpoints];
  return checkpoint ? demoApiJson(checkpoint) : demoApiNotFound();
}

export const OPTIONS = demoApiOptions;
