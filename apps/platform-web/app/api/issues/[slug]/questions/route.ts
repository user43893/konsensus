import { demoIssueOverviews } from "@konsensus/instance-conformance-demo/public-data";
import {
  demoApiJson,
  demoApiNotFound,
  demoApiOptions,
} from "../../../../../lib/demo-api";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const overview = demoIssueOverviews[slug];
  return overview
    ? demoApiJson({
        issue: overview.issue,
        questions: overview.questions,
      })
    : demoApiNotFound();
}

export const OPTIONS = demoApiOptions;
