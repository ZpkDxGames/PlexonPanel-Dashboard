export const RECEIPT_PATH = "docs/coordinated-deployment-5.0.0.json";
const SHA = /^[0-9a-f]{40}$/;
const EVIDENCE = ["currentOperationalBackup", "offVpsIntegrity", "rollbackRehearsal", "operatorDeploymentReady"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EXCEPTION_STATUS = {
  currentOperationalBackup: "SKIPPED_OPERATOR_DECISION",
  offVpsIntegrity: "SKIPPED_OPERATOR_DECISION",
  rollbackRehearsal: "NOT_EXECUTED_OPERATOR_ACCEPTED",
};

function operatorExceptionAccepted(receipt) {
  const decision = receipt.operatorDecision;
  if (receipt.schemaVersion !== 2 || !decision || decision.approved !== true
      || decision.intent !== "STAGED_VPS_MIGRATION"
      || decision.acceptedDashboardSourceCommit !== receipt.acceptedDashboardSourceCommit
      || decision.acceptedCoreSourceCommit !== receipt.acceptedCoreSourceCommit
      || receipt.legacyInstallationsRetained !== true || receipt.runtimeCertification !== "NOT_EXECUTED"
      || typeof decision.reason !== "string" || !decision.reason.trim() || decision.reason.length > 500
      || typeof decision.confirmedAt !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(decision.confirmedAt)
      || !Number.isFinite(Date.parse(decision.confirmedAt))
      || !UUID.test(decision.scope?.nodeId ?? "") || !UUID.test(decision.scope?.serverId ?? "")
      || !/^[a-z][a-z0-9-]{0,47}$/.test(decision.scope?.instanceKey ?? "")
      || !Array.isArray(decision.exceptions) || decision.exceptions.length === 0
      || new Set(decision.exceptions).size !== decision.exceptions.length
      || !decision.exceptions.every(key => Object.hasOwn(EXCEPTION_STATUS, key))) return false;
  return EVIDENCE.every(key => decision.exceptions.includes(key)
    ? receipt.evidence?.[key] === EXCEPTION_STATUS[key]
    : receipt.evidence?.[key] === "PASS");
}

export function deploymentDecision({ version, receipt, parent, changedPaths }) {
  if (version === "4.0.0") return { allowed: true, code: "LEGACY_FOUR_DEPLOYMENT" };
  if (version !== "5.0.0") return { allowed: false, code: "UNSUPPORTED_DEPLOYMENT_VERSION" };
  if (!receipt || ![1, 2].includes(receipt.schemaVersion) || receipt.version !== version || receipt.state !== "READY")
    return { allowed: false, code: "COORDINATED_DEPLOYMENT_HELD" };
  if (!SHA.test(receipt.acceptedDashboardSourceCommit ?? "") || !SHA.test(receipt.acceptedCoreSourceCommit ?? "")
      || receipt.acceptedDashboardSourceCommit !== parent)
    return { allowed: false, code: "ACCEPTED_SOURCE_MISMATCH" };
  if (!Array.isArray(changedPaths) || changedPaths.length !== 1 || changedPaths[0] !== RECEIPT_PATH)
    return { allowed: false, code: "ACTIVATION_COMMIT_CHANGED_SOURCE" };
  const executedEvidence = receipt.schemaVersion === 1 && EVIDENCE.every(key => receipt.evidence?.[key] === "PASS");
  const acceptedException = operatorExceptionAccepted(receipt);
  if (![receipt.dashboardCiRun, receipt.coreCiRun].every(value => Number.isSafeInteger(value) && value > 0)
      || !(executedEvidence || acceptedException)
      || receipt.evidence?.ociBackup !== "SKIPPED_OPERATOR_DECISION")
    return { allowed: false, code: "COORDINATION_EVIDENCE_INCOMPLETE" };
  return { allowed: true, code: acceptedException ? "OPERATOR_EXCEPTION_FIVE_STAGING_DEPLOYMENT" : "COORDINATED_FIVE_DEPLOYMENT" };
}
