import type { JsonMap } from "../adapter/control-state";

const DANGEROUS_COMMAND =
  /^(?:(?:stop|op|deop|ban|kill|fill|reload)\b|whitelist\s+off)/i;

export function normalizeConsoleCommand(value: string): string {
  return value
    .replace(/[\r\n]/g, " ")
    .trim()
    .replace(/^\/+/, "")
    .slice(0, 4096);
}

export function requiresTypedConfirmation(
  action: string,
  parameters: JsonMap,
): boolean {
  if (
    [
      "player.ban",
      "player.kill",
      "player.op",
      "player.deop",
      "backup.full.delete",
      "files.delete",
      "backup.full.restore",
    ].includes(action)
  )
    return true;
  return (
    action === "console.execute" &&
    DANGEROUS_COMMAND.test(
      normalizeConsoleCommand(String(parameters.command ?? "")),
    )
  );
}

export function requiresAgentConfirmation(
  action: string,
  parameters: JsonMap,
): boolean {
  return (
    action === "server.stop" ||
    action === "server.restart" ||
    requiresTypedConfirmation(action, parameters)
  );
}

export function parseCommandHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const command = normalizeConsoleCommand(item);
    if (!command || result.includes(command)) continue;
    result.push(command);
    if (result.length === 200) break;
  }
  return result;
}

export function recordCommand(
  history: readonly string[],
  value: string,
): string[] {
  const command = normalizeConsoleCommand(value);
  if (!command) return [...history];
  return [command, ...history.filter((item) => item !== command)].slice(0, 200);
}

export function removeCommand(
  history: readonly string[],
  value: string,
): string[] {
  const command = normalizeConsoleCommand(value);
  return history.filter((item) => item !== command);
}
