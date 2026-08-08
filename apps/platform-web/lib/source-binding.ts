export const FRONTEND_SOURCE_BINDING_SCHEMA_V3 =
  "qualified-opinion.frontend-source-binding.v3" as const;
export const SOURCE_INVENTORY_FORMAT = "git-ls-files-stage-z" as const;

export type SourceInventoryDigest = {
  algorithm: "sha-256";
  encoding: "hex";
  format: typeof SOURCE_INVENTORY_FORMAT;
  trackedFiles: number;
  value: string;
};

export type VerifiedSourceCheckout = {
  headCommit: string;
  sourceInventory: SourceInventoryDigest;
};

type SourceProvenanceLimitation = {
  status: "not-attested";
  limitation: string;
};

export type BoundFrontendSource = {
  schema: typeof FRONTEND_SOURCE_BINDING_SCHEMA_V3;
  status: "bound";
  repositoryUrl: string;
  sourceCommit: string;
  buildId: string;
  sourceInventory: SourceInventoryDigest;
  provenance: SourceProvenanceLimitation;
};

export type UnboundFrontendSource = {
  schema: typeof FRONTEND_SOURCE_BINDING_SCHEMA_V3;
  status: "unbound";
  repositoryUrl: null;
  sourceCommit: null;
  buildId: null;
  sourceInventory: null;
  provenance: SourceProvenanceLimitation;
};

export type FrontendSourceBinding = BoundFrontendSource | UnboundFrontendSource;

export type SourceBindingEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function resolveFrontendSourceBinding(
  environment: SourceBindingEnvironment,
  inspectCheckout?: () => VerifiedSourceCheckout,
): FrontendSourceBinding {
  const required = parseRequiredFlag(
    environment.KONSENSUS_REQUIRE_SOURCE_BINDING,
  );
  const repositoryUrl = environment.KONSENSUS_PUBLIC_REPOSITORY_URL?.trim();
  const sourceCommit = environment.KONSENSUS_RELEASE_SOURCE_SHA?.trim();
  const buildId = environment.KONSENSUS_RELEASE_BUILD_ID?.trim();
  const supplied = [repositoryUrl, sourceCommit, buildId].filter(
    Boolean,
  ).length;

  if (supplied === 0) {
    if (required) {
      throw new TypeError(
        "Official frontend builds require repository URL, source SHA, and build ID",
      );
    }
    return {
      schema: FRONTEND_SOURCE_BINDING_SCHEMA_V3,
      status: "unbound",
      repositoryUrl: null,
      sourceCommit: null,
      buildId: null,
      sourceInventory: null,
      provenance: {
        status: "not-attested",
        limitation:
          "This reference build claims neither a public source checkout nor independently attested deployment provenance.",
      },
    };
  }
  if (supplied !== 3) {
    throw new TypeError(
      "Source binding is partial; repository URL, source SHA, and build ID must be supplied together",
    );
  }

  const claimedCommit = assertSourceCommit(sourceCommit as string);
  if (!inspectCheckout) {
    throw new TypeError(
      "A bound frontend build requires inspection of the clean Git checkout",
    );
  }
  const checkout = inspectCheckout();
  const checkoutCommit = assertSourceCommit(checkout.headCommit);
  if (checkoutCommit !== claimedCommit) {
    throw new TypeError(
      "KONSENSUS_RELEASE_SOURCE_SHA does not match the build checkout HEAD",
    );
  }

  return {
    schema: FRONTEND_SOURCE_BINDING_SCHEMA_V3,
    status: "bound",
    repositoryUrl: normalizeRepositoryUrl(repositoryUrl as string),
    sourceCommit: claimedCommit,
    buildId: assertBuildId(buildId as string),
    sourceInventory: assertSourceInventory(checkout.sourceInventory),
    provenance: {
      status: "not-attested",
      limitation:
        "The build verified a clean checkout at this commit and recorded its tracked-file inventory. This self-reported endpoint does not prove which artifact or code the hosting provider served; verify signed release and hosting provenance separately.",
    },
  };
}

export function parseEmbeddedFrontendSourceBinding(
  serialized: string,
  requireBinding = false,
): FrontendSourceBinding {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new TypeError("Embedded frontend source binding is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new TypeError("Embedded frontend source binding must be an object");
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    candidate.schema !== FRONTEND_SOURCE_BINDING_SCHEMA_V3 ||
    (candidate.status !== "bound" && candidate.status !== "unbound")
  ) {
    throw new TypeError(
      "Embedded frontend source binding has an invalid schema",
    );
  }
  const provenance = assertProvenance(candidate.provenance);
  if (candidate.status === "unbound") {
    if (requireBinding) {
      throw new TypeError("Official frontend build is unexpectedly unbound");
    }
    if (
      candidate.repositoryUrl !== null ||
      candidate.sourceCommit !== null ||
      candidate.buildId !== null ||
      candidate.sourceInventory !== null
    ) {
      throw new TypeError("Embedded unbound source status is malformed");
    }
    return {
      schema: FRONTEND_SOURCE_BINDING_SCHEMA_V3,
      status: "unbound",
      repositoryUrl: null,
      sourceCommit: null,
      buildId: null,
      sourceInventory: null,
      provenance,
    };
  }

  return {
    schema: FRONTEND_SOURCE_BINDING_SCHEMA_V3,
    status: "bound",
    repositoryUrl: normalizeRepositoryUrl(String(candidate.repositoryUrl)),
    sourceCommit: assertSourceCommit(String(candidate.sourceCommit)),
    buildId: assertBuildId(String(candidate.buildId)),
    sourceInventory: assertSourceInventory(candidate.sourceInventory),
    provenance,
  };
}

export function frontendSourceBindingForRuntime(
  environment: SourceBindingEnvironment,
): FrontendSourceBinding {
  const required = parseRequiredFlag(
    environment.KONSENSUS_REQUIRE_SOURCE_BINDING,
  );
  const embedded = environment.KONSENSUS_EMBEDDED_SOURCE_BINDING;
  return embedded
    ? parseEmbeddedFrontendSourceBinding(embedded, required)
    : resolveFrontendSourceBinding(environment);
}

function assertSourceInventory(value: unknown): SourceInventoryDigest {
  if (!value || typeof value !== "object") {
    throw new TypeError("Source inventory digest is missing");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.algorithm !== "sha-256" ||
    candidate.encoding !== "hex" ||
    candidate.format !== SOURCE_INVENTORY_FORMAT ||
    !Number.isSafeInteger(candidate.trackedFiles) ||
    (candidate.trackedFiles as number) < 0 ||
    typeof candidate.value !== "string" ||
    !/^[0-9a-f]{64}$/.test(candidate.value)
  ) {
    throw new TypeError("Source inventory digest is malformed");
  }
  return {
    algorithm: "sha-256",
    encoding: "hex",
    format: SOURCE_INVENTORY_FORMAT,
    trackedFiles: candidate.trackedFiles as number,
    value: candidate.value,
  };
}

function assertProvenance(value: unknown): SourceProvenanceLimitation {
  if (!value || typeof value !== "object") {
    throw new TypeError("Source provenance limitation is missing");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.status !== "not-attested" ||
    typeof candidate.limitation !== "string" ||
    candidate.limitation.trim() === ""
  ) {
    throw new TypeError("Source provenance limitation is malformed");
  }
  return {
    status: "not-attested",
    limitation: candidate.limitation,
  };
}

function normalizeRepositoryUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(
      "KONSENSUS_PUBLIC_REPOSITORY_URL must be an absolute HTTPS URL",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname === "/"
  ) {
    throw new TypeError(
      "KONSENSUS_PUBLIC_REPOSITORY_URL must be a credential-free HTTPS repository URL without query or fragment",
    );
  }
  return url.toString().replace(/\/+$/, "");
}

function assertSourceCommit(value: string) {
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new TypeError(
      "KONSENSUS_RELEASE_SOURCE_SHA must be an exact lowercase 40-hex Git object ID",
    );
  }
  return value;
}

function assertBuildId(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new TypeError(
      "KONSENSUS_RELEASE_BUILD_ID must be 1-128 URL-safe characters",
    );
  }
  return value;
}

function parseRequiredFlag(value: string | undefined) {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new TypeError(
    "KONSENSUS_REQUIRE_SOURCE_BINDING must be exactly true or false",
  );
}
