"use client";

import { useCallback, useRef, useState, type RefObject, type Dispatch, type SetStateAction } from "react";
import { ActionError, captureActionTarget, sendDashboardAction, type ActionCompletion } from "../lib/data-source";
import type { SessionActivityInput } from "../lib/session-activity";
import type { RelayCredential } from "../lib/browser-store";
import { compatibleActionTarget, str, type ControlState, type JsonMap, type Ready } from "../lib/control-state";
import { reconcileDeviceGrant, type DeviceGrantLike } from "../lib/device-grant";
import { ACTION_CONTRACT_ID, canAction, HIGH_RISK } from "../lib/scopes";
import { actionLabel, operationText } from "../lib/operation-messages";

export type Phase = "loading" | "unpaired" | "connecting" | "live" | "reconnecting";
export type Confirmation = {
  action: string;
  parameters: JsonMap;
  serverId: string;
  serverName: string;
  targetName?: string;
  returnFocusElement?: HTMLElement;
  resolve: (approved: boolean) => void;
};
function actionAuthority(action: string, ready: Ready | null, requested?: "PAPER" | "HOST"): "PAPER" | "HOST" {
  if (requested) return requested;
  if (action.startsWith("backup.") || action.startsWith("maintenance.") || action.startsWith("provider.")
      || (action.startsWith("server.") && action !== "server.status")) return "HOST";
  if ((action.startsWith("files.") || action === "server.status") && ready?.agents.host) return "HOST";
  return "PAPER";
}

/** Owns immutable confirmation parameters and exact signed target generations. */
export function useSignedOperations({ credential, sessionGrant, state, phase, selectionRevision, authoritativeState, setNotice, observeActivity }: {
  credential: RelayCredential | null;
  sessionGrant: DeviceGrantLike | null;
  state: ControlState;
  phase: Phase;
  selectionRevision: RefObject<number>;
  authoritativeState: RefObject<ControlState>;
  setNotice: Dispatch<SetStateAction<string>>;
  observeActivity: (input: SessionActivityInput) => void;
}) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationRef = useRef<Confirmation | null>(null);
  const cancelConfirmation = useCallback(() => confirmationRef.current?.resolve(false), []);
  const can = useCallback(
    (action: string, requestedKind?: "PAPER" | "HOST") => {
      const ready = state.ready;
      if (
        !ready ||
        phase !== "live" ||
        (ready.actionContract !== undefined &&
          ready.actionContract !== ACTION_CONTRACT_ID)
      )
        return false;
      const grant = reconcileDeviceGrant(sessionGrant, ready.device);
      if (!grant) return false;
      if (
        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore")) &&
        grant.role !== "Owner"
      )
        return false;
      const kind = actionAuthority(action, ready, requestedKind);
      return (
        compatibleActionTarget(ready, kind) &&
        Boolean(kind === "HOST" ? ready.agents.host : ready.agents.paper) &&
        canAction(
          action,
          grant.scopes,
          kind === "HOST"
            ? ready.server.hostCapabilities
            : ready.server.paperCapabilities,
        )
      );
    },
    [sessionGrant, state.ready, phase],
  );

  const run = useCallback(
    async (
      action: string,
      parameters: JsonMap,
      kind?: "PAPER" | "HOST",
      confirmationMode: "default" | "preconfirmed" = "default",
    ): Promise<ActionCompletion> => {
      const revision = selectionRevision.current;
      const expectedServerId = credential?.serverId ?? "";
      kind = actionAuthority(action, state.ready, kind);
      const targetConnection = captureActionTarget(expectedServerId, kind);
      parameters = structuredClone(parameters);
      if (!can(action, kind)) {
        const unavailable = new Error(
          "This action is unavailable for the current device or local policy.",
        );
        setNotice(unavailable.message);
        throw unavailable;
      }
      if (
        confirmationMode !== "preconfirmed" &&
        (HIGH_RISK.has(action) || action.startsWith("player.") ||
          action === "chat.global.send" || action === "files.write" || action === "server.start" ||
          action === "backup.full.retry-upload" ||
          action === "console.execute" ||
          action === "plugin.command.reload")
      ) {
        const approved = await new Promise<boolean>((resolve) => {
          cancelConfirmation();
          const next: Confirmation = {
            action, parameters, serverId: expectedServerId,
            returnFocusElement: (document.querySelector('[data-action-return-focus]') as HTMLElement | null) ?? (document.activeElement instanceof window.HTMLElement ? document.activeElement : undefined),
            targetName: action.startsWith('player.') && authoritativeState.current.serverId===expectedServerId
              ? str(authoritativeState.current.players.find(player=>player.uuid===parameters.playerId)?.name,'Unknown player') : undefined,
            serverName: str(state.ready?.server.serverName ?? state.server.serverName,
              `Server ${expectedServerId.slice(0, 8)}`),
            resolve: (ok) => {
              if (confirmationRef.current === next) {
                confirmationRef.current = null;
                setConfirmation(null);
              }
              resolve(ok);
            },
          };
          confirmationRef.current = next;
          setConfirmation(next);
        });
        if (!approved) throw new Error("Cancelled");
        parameters = { ...parameters, confirmed: true };
      }
      if (confirmationMode === "preconfirmed")
        parameters = { ...parameters, confirmed: true };
      if (!can(action, kind)) {
        const unavailable = new Error(
          "The live authorization changed before the action was sent. Review the current device grant and try again.",
        );
        setNotice(unavailable.message);
        throw unavailable;
      }
      try {
        const result = await sendDashboardAction(action, parameters, kind, targetConnection);
        if (captureActionTarget(expectedServerId, kind).generation !== targetConnection.generation)
          throw new Error("The target connection changed before completion was displayed.");
        observeActivity({ kind: "action", serverId: expectedServerId, action, authority: kind, status: result.status, code: result.code });
        setNotice(
          `${actionLabel(action)}: ${str(result.data.message, result.message || "Operation completed.")}`,
        );
        return result;
      } catch (reason) {
        if (reason instanceof ActionError && revision === selectionRevision.current && authoritativeState.current.serverId === expectedServerId)
          observeActivity({ kind: "action", serverId: expectedServerId, action, authority: kind, status: reason.status, code: reason.code });
        if (revision === selectionRevision.current && authoritativeState.current.serverId === expectedServerId) setNotice(`${actionLabel(action)}: ${operationText(reason)}`);
        throw reason;
      }
    },
    [can, credential?.serverId, state.ready, state.server.serverName, cancelConfirmation, selectionRevision, authoritativeState, setNotice, observeActivity],
  );

  return { confirmation, cancelConfirmation, can, run };
}
