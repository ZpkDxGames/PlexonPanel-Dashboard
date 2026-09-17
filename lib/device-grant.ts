export interface DeviceGrantLike {
  deviceId: string;
  role: string;
  scopes: readonly string[];
}

export interface EffectiveDeviceGrant extends DeviceGrantLike {
  metadataMatches: boolean;
}

function sameScopes(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const leftScopes = new Set(left);
  const rightScopes = new Set(right);
  return (
    leftScopes.size === left.length &&
    rightScopes.size === right.length &&
    left.every((scope) => rightScopes.has(scope))
  );
}

/**
 * Reconcile the grant stored beside the signed browser token with the device
 * metadata reported by the live relay. The intersection is the only safe UI
 * authority: either side can be stale during an upgrade, while the relay still
 * enforces the immutable scopes embedded in the signed token.
 */
export function reconcileDeviceGrant(
  signed: DeviceGrantLike | null | undefined,
  reported: DeviceGrantLike | null | undefined,
): EffectiveDeviceGrant | null {
  if (!signed || !reported || signed.deviceId !== reported.deviceId) return null;

  const roleMatches = signed.role === reported.role;
  const reportedScopes = new Set(reported.scopes);
  const scopes = roleMatches
    ? signed.scopes.filter(
        (scope, index) =>
          signed.scopes.indexOf(scope) === index && reportedScopes.has(scope),
      )
    : [];

  return {
    deviceId: signed.deviceId,
    role: roleMatches ? signed.role : "",
    scopes,
    metadataMatches: roleMatches && sameScopes(signed.scopes, reported.scopes),
  };
}
