import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

const requiredGitleaksVersion = "8.30.1";
const textDecoder = new TextDecoder();

function commandOutput(result: Bun.SyncSubprocess) {
  return {
    stderr: textDecoder.decode(result.stderr),
    stdout: textDecoder.decode(result.stdout),
  };
}

function checkedCommand(command: string[], cwd: string) {
  const result = Bun.spawnSync(command, {
    cwd,
    stderr: "pipe",
    stdout: "pipe",
  });
  const output = commandOutput(result);

  if (result.exitCode !== 0) {
    throw new Error(
      `${command.join(" ")} failed with exit code ${result.exitCode}\n${output.stderr}${output.stdout}`,
    );
  }

  return output.stdout;
}

const repositoryRoot = resolve(
  checkedCommand(["git", "rev-parse", "--show-toplevel"], process.cwd()).trim(),
);
const gitleaksBinary = process.env.KONSENSUS_GITLEAKS_BIN?.trim() || "gitleaks";

const versionResult = Bun.spawnSync([gitleaksBinary, "version"], {
  cwd: repositoryRoot,
  stderr: "pipe",
  stdout: "pipe",
});
const versionOutput = commandOutput(versionResult);

if (
  versionResult.exitCode !== 0 ||
  versionOutput.stdout.trim() !== requiredGitleaksVersion
) {
  throw new Error(
    `Gitleaks ${requiredGitleaksVersion} is required for the release gate.`,
  );
}

const temporaryRoot = await mkdtemp(
  join(tmpdir(), "konsensus-gitleaks-source-"),
);
const sourceSnapshot = join(temporaryRoot, "source");
const detectorSelfTest = join(temporaryRoot, "self-test");

try {
  await mkdir(sourceSnapshot);
  await mkdir(detectorSelfTest);
  await writeFile(
    join(detectorSelfTest, "must-be-detected.txt"),
    ['api_key="', "xY7pQ2mN9vK4cR8tL3wF6sH1", "jD5bG0zA", '"\n'].join(""),
  );

  const commonArguments = [
    "dir",
    "--no-banner",
    "--redact",
    "--config",
    join(repositoryRoot, ".gitleaks.toml"),
  ];
  const selfTestResult = Bun.spawnSync(
    [gitleaksBinary, ...commonArguments, detectorSelfTest],
    {
      cwd: repositoryRoot,
      stderr: "ignore",
      stdout: "ignore",
    },
  );

  if (selfTestResult.exitCode !== 1) {
    throw new Error(
      `Gitleaks detector self-test returned ${selfTestResult.exitCode}; expected 1.`,
    );
  }

  const listedPaths = checkedCommand(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    repositoryRoot,
  )
    .split("\0")
    .filter(Boolean);
  let copiedFileCount = 0;

  for (const repositoryPath of listedPaths) {
    if (
      isAbsolute(repositoryPath) ||
      repositoryPath.split("/").includes("..")
    ) {
      throw new Error(`Unsafe repository path: ${repositoryPath}`);
    }

    const sourcePath = join(repositoryRoot, repositoryPath);
    const destinationPath = join(sourceSnapshot, repositoryPath);
    const sourceStat = await lstat(sourcePath).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          return undefined;
        }
        throw error;
      },
    );

    // A cached path can be absent when it is deleted in the candidate worktree.
    if (!sourceStat) {
      continue;
    }

    await mkdir(dirname(destinationPath), { recursive: true });
    if (sourceStat.isSymbolicLink()) {
      await symlink(await readlink(sourcePath), destinationPath);
    } else if (sourceStat.isFile()) {
      await copyFile(sourcePath, destinationPath);
    } else {
      throw new Error(`Unsupported repository entry: ${repositoryPath}`);
    }
    copiedFileCount += 1;
  }

  const scanResult = Bun.spawnSync(
    [gitleaksBinary, ...commonArguments, sourceSnapshot],
    {
      cwd: repositoryRoot,
      stderr: "pipe",
      stdout: "pipe",
    },
  );
  const scanOutput = commandOutput(scanResult);

  process.stdout.write(scanOutput.stdout);
  process.stderr.write(scanOutput.stderr);

  if (scanResult.exitCode !== 0) {
    process.exitCode = scanResult.exitCode;
  } else {
    console.log(
      `Gitleaks ${requiredGitleaksVersion} verified ${copiedFileCount} current source files.`,
    );
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
