import type { SessionSnapshot } from "./adapter/session";

export type EntryExperience = "splash" | "pairing" | "dashboard";

export function entryExperience(
  snapshot: Pick<SessionSnapshot, "initialized" | "credentials" | "fixture">,
  minimumSplashElapsed: boolean,
): EntryExperience {
  if (!snapshot.initialized || !minimumSplashElapsed) return "splash";
  if (!snapshot.fixture && snapshot.credentials.length === 0) return "pairing";
  return "dashboard";
}
