import type { SessionSnapshot } from "../adapter/session";
import { reconcileDeviceGrant } from "../adapter/device-grant";
export function hasScope(snapshot: SessionSnapshot, scope: string): boolean {
  return Boolean(
    reconcileDeviceGrant(
      snapshot.grant,
      snapshot.state.ready?.device,
    )?.scopes.includes(scope),
  );
}
