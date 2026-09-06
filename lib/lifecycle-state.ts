export type ServiceState =
  | "active"
  | "inactive"
  | "activating"
  | "deactivating"
  | "failed"
  | "unknown";

export type LifecycleAction = "start" | "stop" | "restart";

export function normalizeServiceState(
  value: unknown,
  paperOnline: boolean,
): ServiceState {
  const state = typeof value === "string" ? value.toLowerCase() : "";
  if (state === "active" || state === "running") return "active";
  if (state === "inactive" || state === "stopped" || state === "dead")
    return "inactive";
  if (state === "activating" || state === "starting") return "activating";
  if (state === "deactivating" || state === "stopping")
    return "deactivating";
  if (state === "failed") return "failed";
  return paperOnline ? "active" : "unknown";
}

export function lifecycleActionAllowed(
  action: LifecycleAction,
  state: ServiceState,
): boolean {
  if (
    state === "activating" ||
    state === "deactivating" ||
    state === "unknown"
  )
    return false;
  if (action === "start") return state === "inactive" || state === "failed";
  if (action === "stop") return state === "active";
  return state === "active";
}
