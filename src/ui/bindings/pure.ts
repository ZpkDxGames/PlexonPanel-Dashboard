// Pure protocol exports are available only through this seam.
export {
  record,
  records,
  number,
  str,
  consoleStrongId,
} from "../../adapter/control-state";
export type {
  ControlState,
  JsonMap,
  Sample,
} from "../../adapter/control-state";
export {
  historyFor,
  sourceEvidence,
  displaySegments,
  observedSummary,
  verifiedNodes,
} from "../../presentation/telemetry";
export { parseTextFormat, plainText } from "../../lib/textFormat";
export { playerCommand, permissionCommand } from "../../lib/playerCommands";
export { playerHistoryPage } from "../../presentation/player-history";
export { reviewPolicy } from "../../presentation/review-policy";
export { SCOPES } from "../../adapter/scopes";
export { validateMaintenance } from "../../adapter/maintenance";
export type { MaintenanceSettings } from "../../adapter/maintenance";
export type { ActionCompletion } from "../../adapter/data-source";
