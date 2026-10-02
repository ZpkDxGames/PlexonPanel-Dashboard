export const RECEIPT_PATH = "docs/coordinated-deployment-5.0.0.json";
const SHA = /^[0-9a-f]{40}$/;
const EVIDENCE = ["currentOperationalBackup", "offVpsIntegrity", "rollbackRehearsal", "operatorDeploymentReady"];

export function deploymentDecision({ version, receipt, parent, changedPaths }) {
  if (version === "4.0.0") return { allowed: true, code: "LEGACY_FOUR_DEPLOYMENT" };
  if (version !== "5.0.0") return { allowed: false, code: "UNSUPPORTED_DEPLOYMENT_VERSION" };
  if (!receipt || receipt.schemaVersion !== 1 || receipt.version !== version || receipt.state !== "READY")
    return { allowed: false, code: "COORDINATED_DEPLOYMENT_HELD" };
  if (!SHA.test(receipt.acceptedDashboardSourceCommit ?? "") || !SHA.test(receipt.acceptedCoreSourceCommit ?? "")
      || receipt.acceptedDashboardSourceCommit !== parent)
    return { allowed: false, code: "ACCEPTED_SOURCE_MISMATCH" };
  if (!Array.isArray(changedPaths) || changedPaths.length !== 1 || changedPaths[0] !== RECEIPT_PATH)
    return { allowed: false, code: "ACTIVATION_COMMIT_CHANGED_SOURCE" };
  if (![receipt.dashboardCiRun, receipt.coreCiRun].every(value => Number.isSafeInteger(value) && value > 0)
      || !EVIDENCE.every(key => receipt.evidence?.[key] === "PASS")
      || receipt.evidence?.ociBackup !== "SKIPPED_OPERATOR_DECISION")
    return { allowed: false, code: "COORDINATION_EVIDENCE_INCOMPLETE" };
  return { allowed: true, code: "COORDINATED_FIVE_DEPLOYMENT" };
}
