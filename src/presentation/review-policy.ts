import { HIGH_RISK } from "../adapter/scopes";
const typed = new Set([
  "player.ban",
  "player.kill",
  "player.op",
  "player.deop",
  "backup.full.delete",
]);
/** Applies only after an explicit review-dialog dispatch; never to navigation or session.query. */
export function reviewPolicy(action: string) {
  return {
    typed: typed.has(action),
    confirmed:
      HIGH_RISK.has(action) ||
      action === "console.execute" ||
      action === "plugin.command.reload",
  };
}
