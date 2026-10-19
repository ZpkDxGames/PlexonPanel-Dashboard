import type { ControlState } from "../../adapter/control-state";
export function serverState(
  s: ControlState,
  paperFresh: boolean,
  hostFresh: boolean,
): "online" | "starting" | "stopping" | "stopped" | "unknown" {
  if (paperFresh) return "online";
  if (!hostFresh) return "unknown";
  const state = String(s.service.state);
  if (["inactive", "failed"].includes(state)) return "stopped";
  if (state === "activating") return "starting";
  if (state === "deactivating") return "stopping";
  if (state === "active")
    return s.service.minecraftReady === true ? "online" : "starting";
  return "unknown";
}
