const safeName = /^[A-Za-z0-9_.-]{1,32}$/;
const safeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function playerCommand(template: string, player: { name: string; uuid: string }): string {
  if (!safeName.test(player.name) || !safeUuid.test(player.uuid)) throw new Error("Player identity contains unsupported characters.");
  if (/[\u0000-\u001f\u007f]/.test(template)) throw new Error("Commands cannot contain control characters or new lines.");
  const command = template.replaceAll("{player}", player.name).replaceAll("{uuid}", player.uuid).trim();
  if (!command || command.length > 512) throw new Error("Command must contain 1–512 characters.");
  if (command.includes("{") || command.includes("}")) throw new Error("The command contains an unknown placeholder.");
  return command.startsWith("/") ? command.slice(1) : command;
}

export function permissionCommand(input: { player: string; node: string; mode: "set" | "unset"; value?: boolean }): string {
  if (!safeName.test(input.player) && !safeUuid.test(input.player)) throw new Error("Invalid player name.");
  if (!/^[a-z0-9*_.-]{1,128}$/i.test(input.node)) throw new Error("Permission nodes may contain letters, digits, dots, dashes, underscores and * only.");
  return input.mode === "unset"
    ? `lp user ${input.player} permission unset ${input.node}`
    : `lp user ${input.player} permission set ${input.node} ${input.value === false ? "false" : "true"}`;
}
