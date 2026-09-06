import { ActionError } from "./data-source";

export interface OperationMessage {
  title: string;
  detail: string;
  tone: "warning" | "danger" | "info";
}

const OPERATION_MESSAGES: Record<string, OperationMessage> = {
  CAPABILITY_DISABLED: {
    title: "Disabled by local policy",
    detail: "This capability is disabled on the selected Paper or Host agent. Review the local PlexonPanel policy before retrying.",
    tone: "warning",
  },
  SCOPE_DENIED: {
    title: "Permission unavailable",
    detail: "This device does not have the scope required for the requested operation.",
    tone: "warning",
  },
  OWNER_REQUIRED: {
    title: "Owner role required",
    detail: "This operation is intentionally restricted to a locally paired Owner device.",
    tone: "warning",
  },
  CONFIRMATION_REQUIRED: {
    title: "Confirmation required",
    detail: "Review the operation and confirm it before it can be sent to the server.",
    tone: "info",
  },
  DEVICE_REVOKED: {
    title: "Device access revoked",
    detail: "This browser is no longer authorized. Pair it again from the local server console or in-game command.",
    tone: "danger",
  },
  DEVICE_EXPIRED: {
    title: "Device access expired",
    detail: "This browser credential has expired. Generate a new local pairing code to continue.",
    tone: "danger",
  },
  BUSY: {
    title: "Another operation is running",
    detail: "Wait for the current host operation to finish, then refresh the affected view before retrying.",
    tone: "warning",
  },
  OPERATION_FAILED: {
    title: "Host operation failed",
    detail: "The operation failed on the host. Check the local host audit or systemd logs for the authoritative failure reason.",
    tone: "danger",
  },
  SERVER_MUST_BE_STOPPED: {
    title: "Server must be stopped",
    detail: "Stop Paper gracefully and wait for the service to become inactive before continuing.",
    tone: "warning",
  },
  RESTORE_RECOVERY_REQUIRED: {
    title: "Restore recovery required",
    detail: "The host has a pending restore recovery state. Complete or review recovery locally before starting Paper.",
    tone: "danger",
  },
};

export function operationMessage(error: unknown): OperationMessage {
  if (error instanceof ActionError) {
    const mapped = OPERATION_MESSAGES[error.code];
    if (mapped) return mapped;
    return {
      title: error.status === "DENIED" ? "Operation denied" : "Operation failed",
      detail: error.message || "The agent rejected the operation.",
      tone: error.status === "DENIED" ? "warning" : "danger",
    };
  }
  return {
    title: "Operation could not be completed",
    detail: error instanceof Error ? error.message : "The operation did not complete successfully.",
    tone: "danger",
  };
}

export function operationText(error: unknown): string {
  const mapped = operationMessage(error);
  return `${mapped.title}: ${mapped.detail}`;
}
