export interface BuildIdentity {
  version: string;
  gitCommit: string;
  buildTimestamp: string;
  protocolVersion: number;
  runtimeKind: string;
  actionContract?: string;
}

export interface ControlPlaneBuilds {
  dashboard: BuildIdentity | null;
  relay: BuildIdentity | null;
  status: "MATCHED" | "MISMATCH" | "UNVERIFIED";
  message: string;
}

function buildIdentity(value: unknown): BuildIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.version !== "string" ||
    typeof candidate.gitCommit !== "string" ||
    typeof candidate.buildTimestamp !== "string" ||
    typeof candidate.protocolVersion !== "number" ||
    typeof candidate.runtimeKind !== "string"
  )
    return null;
  return {
    version: candidate.version,
    gitCommit: candidate.gitCommit,
    buildTimestamp: candidate.buildTimestamp,
    protocolVersion: candidate.protocolVersion,
    runtimeKind: candidate.runtimeKind,
    ...(typeof candidate.actionContract === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(candidate.actionContract)
      ? { actionContract: candidate.actionContract }
      : {}),
  };
}

function relayOrigin(): URL | null {
  const raw = process.env.NEXT_PUBLIC_PLEXON_RELAY_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)))
      return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchIdentity(url: URL | string): Promise<BuildIdentity | null> {
  try {
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return buildIdentity(await response.json());
  } catch {
    return null;
  }
}

function knownCommit(identity: BuildIdentity | null): string | null {
  const commit = identity?.gitCommit ?? "";
  return /^[0-9a-f]{7,64}$/i.test(commit) ? commit.toLowerCase() : null;
}

export async function loadControlPlaneBuilds(): Promise<ControlPlaneBuilds> {
  const relay = relayOrigin();
  const [dashboardBuild, relayBuild] = await Promise.all([
    fetchIdentity("/api/build"),
    relay ? fetchIdentity(new URL("healthz", relay)) : Promise.resolve(null),
  ]);
  const dashboardCommit = knownCommit(dashboardBuild);
  const relayCommit = knownCommit(relayBuild);
  if (!dashboardCommit || !relayCommit) {
    return {
      dashboard: dashboardBuild,
      relay: relayBuild,
      status: "UNVERIFIED",
      message: "Control-plane build identity is unavailable. Do not treat this deployment as fully verified.",
    };
  }
  if (dashboardCommit !== relayCommit) {
    return {
      dashboard: dashboardBuild,
      relay: relayBuild,
      status: "MISMATCH",
      message: "Control-plane deployment mismatch: Dashboard and relay were not built from the same accepted revision.",
    };
  }
  return {
    dashboard: dashboardBuild,
    relay: relayBuild,
    status: "MATCHED",
    message: "Dashboard and relay report the same accepted revision.",
  };
}
