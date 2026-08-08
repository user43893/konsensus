import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  SOURCE_INVENTORY_FORMAT,
  type VerifiedSourceCheckout,
} from "./source-binding";

export function inspectGitSourceCheckout(
  workingDirectory = process.cwd(),
): VerifiedSourceCheckout {
  const repositoryRoot = gitText(workingDirectory, [
    "rev-parse",
    "--show-toplevel",
  ]);
  const headCommit = gitText(repositoryRoot, ["rev-parse", "--verify", "HEAD"]);
  const status = gitBytes(repositoryRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  if (status.byteLength !== 0) {
    throw new TypeError(
      "A bound frontend build requires a clean Git checkout, including no untracked files",
    );
  }

  const inventory = gitBytes(repositoryRoot, ["ls-files", "--stage", "-z"]);
  return {
    headCommit,
    sourceInventory: {
      algorithm: "sha-256",
      encoding: "hex",
      format: SOURCE_INVENTORY_FORMAT,
      trackedFiles: countNullTerminators(inventory),
      value: createHash("sha256").update(inventory).digest("hex"),
    },
  };
}

function gitText(workingDirectory: string, arguments_: readonly string[]) {
  return execFileSync("git", arguments_, {
    cwd: workingDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitBytes(workingDirectory: string, arguments_: readonly string[]) {
  return execFileSync("git", arguments_, {
    cwd: workingDirectory,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function countNullTerminators(value: Buffer) {
  let count = 0;
  for (const byte of value) {
    if (byte === 0) count += 1;
  }
  return count;
}
