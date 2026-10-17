import {
  readBrowserRelayOrigin,
  writeBrowserRelayOrigin,
  type RelayCredential,
} from "./browser-store";

export const RELAY_PREFERENCE = "plexon:new:relay";
export type RelayConfiguration = {
  origin: string;
  source: "browser" | "deployment" | "pairing" | "unconfigured";
  error: string;
};
export class RelayConfigurationError extends Error {}

function localHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(host);
}
export function normalizeRelayOrigin(raw: string): string {
  if (!raw.trim())
    throw new RelayConfigurationError(
      "The PlexonPanel relay URL is not configured. Open connection settings.",
    );
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new RelayConfigurationError("Enter a valid relay HTTPS origin.");
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && localHost(url.hostname))
  )
    throw new RelayConfigurationError("The PlexonPanel relay must use HTTPS.");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new RelayConfigurationError(
      "The PlexonPanel relay URL must be an origin without credentials, a path, query, or fragment.",
    );
  return url.origin;
}
/** A stored pairing already binds its credential to the relay that issued it. */
export function relayOriginFromPairing(
  credential: Pick<RelayCredential, "websocketUrl">,
): string {
  let url: URL;
  try {
    url = new URL(credential.websocketUrl);
  } catch {
    throw new RelayConfigurationError(
      "The stored pairing has an invalid relay endpoint. Pair again.",
    );
  }
  if (
    (url.protocol !== "wss:" &&
      !(url.protocol === "ws:" && localHost(url.hostname))) ||
    url.pathname !== "/v1/dashboard" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new RelayConfigurationError(
      "The stored pairing has an unsafe relay endpoint. Pair again.",
    );
  return normalizeRelayOrigin(
    `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`,
  );
}
export function resolveRelayConfiguration(input: {
  browserOrigin?: string | null;
  deploymentOrigin?: string;
  credential?: Pick<RelayCredential, "websocketUrl"> | null;
}): RelayConfiguration {
  const source = input.browserOrigin?.trim()
    ? "browser"
    : input.deploymentOrigin?.trim()
      ? "deployment"
      : input.credential
        ? "pairing"
        : "unconfigured";
  try {
    const origin =
      source === "pairing"
        ? relayOriginFromPairing(input.credential!)
        : normalizeRelayOrigin(
            source === "browser"
              ? input.browserOrigin!
              : (input.deploymentOrigin ?? ""),
          );
    return { origin, source, error: "" };
  } catch (error) {
    return { origin: "", source, error: (error as Error).message };
  }
}
let browserOrigin = "";
export async function hydrateRelayPreference(): Promise<void> {
  browserOrigin = await readBrowserRelayOrigin();
  try {
    const old = localStorage.getItem(RELAY_PREFERENCE);
    if (!browserOrigin && old) {
      browserOrigin = normalizeRelayOrigin(old);
      await writeBrowserRelayOrigin(browserOrigin);
    }
    localStorage.removeItem(RELAY_PREFERENCE);
  } catch {}
}
export function browserRelayConfiguration(
  credential?: RelayCredential | null,
): RelayConfiguration {
  return resolveRelayConfiguration({
    browserOrigin,
    deploymentOrigin: process.env.NEXT_PUBLIC_PLEXON_RELAY_URL,
    credential,
  });
}
export async function saveRelayPreference(
  origin: string | null,
): Promise<void> {
  const value = origin === null ? null : normalizeRelayOrigin(origin);
  await writeBrowserRelayOrigin(value);
  browserOrigin = value ?? "";
}
