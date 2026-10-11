import { ACTION_SCOPES } from "../adapter/scopes";

export type CapabilityState = "available" | "denied" | "agent-offline" | "unsupported" | "stale";

export function actionCapability(input: {
  action: string;
  scopes: Iterable<string>;
  advertised?: Record<string, boolean>;
  agentOnline: boolean;
  evidenceUsable?: boolean;
}): { state: CapabilityState; reason: string } {
  const scope = ACTION_SCOPES[input.action];
  if (!scope) return { state: "unsupported", reason: "This action is not in the negotiated protocol contract." };
  if (!new Set(input.scopes).has(scope)) return { state: "denied", reason: `Missing device scope: ${scope}.` };
  if (!input.agentOnline) return { state: "agent-offline", reason: "The required agent is offline." };
  if (input.advertised?.[scope] === false || input.advertised?.[input.action] === false) return { state: "unsupported", reason: "The connected agent does not advertise this capability." };
  if (input.evidenceUsable === false) return { state: "stale", reason: "Wait for current service evidence before dispatching this action." };
  return { state: "available", reason: "" };
}
