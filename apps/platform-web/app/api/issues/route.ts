import { demoIssueList } from "@konsensus/instance-conformance-demo/public-data";
import { demoApiJson, demoApiOptions } from "../../../lib/demo-api";

export function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const query = parameters.get("q")?.trim().toLocaleLowerCase();
  const matter = parameters.get("matter")?.trim();
  const status = parameters.get("status")?.trim();
  const matchingIssues = demoIssueList.issues.filter((issue) => {
    if (status && issue.status !== status) return false;
    if (matter && !issue.matterSlugs.includes(matter)) return false;
    if (!query) return true;
    return [
      issue.title,
      issue.shortTitle,
      issue.summary,
      issue.plainLanguageSummary,
    ]
      .filter((value): value is string => value !== null)
      .some((value) => value.toLocaleLowerCase().includes(query));
  });
  return demoApiJson({ issues: matchingIssues });
}

export const OPTIONS = demoApiOptions;
