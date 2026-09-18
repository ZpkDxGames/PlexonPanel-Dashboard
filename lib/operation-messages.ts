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
  UNKNOWN_ACTION: {
    title: "Relay action contract mismatch",
    detail: "The connected relay room does not recognize this Dashboard action. Wait for the relay deployment to finish before retrying.",
    tone: "danger",
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

function safeDiagnostic(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function diagnosticSuffix(error: ActionError): string {
  const parts: string[] = [];
  const boundary = safeDiagnostic(error.data.rejectionBoundary, /^[A-Z][A-Z0-9_]{1,63}$/);
  const scope = safeDiagnostic(error.data.requiredScope, /^[a-z][a-z0-9_.-]{1,63}$/);
  const agent = safeDiagnostic(error.data.agentKind, /^(PAPER|HOST)$/);
  const contract = safeDiagnostic(error.data.actionContract, /^sha256:[0-9a-f]{64}$/);
  if (boundary) parts.push(`Boundary: ${boundary}`);
  if (scope) parts.push(`Scope: ${scope}`);
  if (typeof error.data.scopeGranted === "boolean")
    parts.push(`Grant: ${error.data.scopeGranted ? "present" : "missing"}`);
  if (agent) parts.push(`Agent: ${agent}`);
  if (contract) parts.push(`Contract: ${contract.slice(7, 19)}`);
  if (/^[0-9a-f-]{36}$/i.test(error.requestId)) parts.push(`Request: ${error.requestId}`);
  return parts.length ? ` Diagnostic: ${parts.join(" · ")}.` : "";
}

export function operationMessage(error: unknown): OperationMessage {
  if (error instanceof ActionError) {
    const mapped = OPERATION_MESSAGES[error.code];
    if (mapped) return { ...mapped, detail: `${mapped.detail}${diagnosticSuffix(error)}` };
    return {
      title: error.status === "DENIED" ? "Operation denied" : "Operation failed",
      detail: `${error.message || "The agent rejected the operation."}${diagnosticSuffix(error)}`,
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
