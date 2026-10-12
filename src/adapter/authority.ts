import type { EffectiveDeviceGrant } from "./device-grant";
import { ACTION_SCOPES, SCOPES, type Scope } from "./scopes";

export type ActionAuthorityState = "available" | "denied" | "unsupported";

export type ActionAuthority = {
  state: ActionAuthorityState;
  scope: Scope | null;
  reason: string;
};

/**
 * Owner is the canonical full-control role in Protocol 3. A verified Owner
 * receives every scope known by this Dashboard contract even when an older
 * reported scope array is incomplete. Other roles retain the reconciled,
 * immutable grant intersection.
 */
export function effectiveGrantScopes(
  grant: EffectiveDeviceGrant | null | undefined,
): ReadonlySet<Scope> {
  if (!grant) return new Set();
  if (grant.role === "Owner") return new Set(SCOPES);
  return new Set(
    grant.scopes.filter((scope): scope is Scope =>
      (SCOPES as readonly string[]).includes(scope),
    ),
  );
}

/** Resolve permission and advertised support once for every action surface. */
export function resolveActionAuthority(input: {
  action: string;
  grant: EffectiveDeviceGrant | null | undefined;
  capabilities: Readonly<Record<string, boolean>>;
}): ActionAuthority {
  const scope = ACTION_SCOPES[input.action] ?? null;
  if (!scope)
    return {
      state: "unsupported",
      scope,
      reason: "This action is not in the negotiated protocol contract.",
    };
  if (!input.grant)
    return {
      state: "denied",
      scope,
      reason: "The signed device grant is unavailable.",
    };
  if (!effectiveGrantScopes(input.grant).has(scope))
    return {
      state: "denied",
      scope,
      reason: `Missing device scope: ${scope}.`,
    };

  const supported =
    input.capabilities[scope] === true ||
    input.capabilities[input.action] === true;
  if (!supported)
    return {
      state: "unsupported",
      scope,
      reason: "The connected agent does not advertise this capability.",
    };
  return { state: "available", scope, reason: "" };
}
