/** Only the existing public relay origin is migrated into the Vite client. */
export function publicRelayOrigin(env: Record<string, string | undefined>): string {
  return env.VITE_PLEXON_RELAY_URL?.trim() || env.NEXT_PUBLIC_PLEXON_RELAY_URL?.trim() || "";
}
