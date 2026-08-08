import { demoEligibilityDirectoryCheckpointHistory } from "@konsensus/instance-conformance-demo/public-data";
import { demoApiJson, demoApiOptions } from "../../../../lib/demo-api";

export function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const start = Number(parameters.get("start") ?? "1");
  const limit = Number(parameters.get("limit") ?? "256");
  if (
    !Number.isSafeInteger(start) ||
    start < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 256
  ) {
    return demoApiJson({ error: "invalid_checkpoint_range" }, 400);
  }
  const matching = demoEligibilityDirectoryCheckpointHistory.checkpoints.filter(
    (checkpoint) => checkpoint.payload.sequence >= start,
  );
  const checkpoints = matching.slice(0, limit);
  return demoApiJson({
    checkpoints,
    limit,
    next:
      matching.length > checkpoints.length ? start + checkpoints.length : null,
  });
}

export const OPTIONS = demoApiOptions;
