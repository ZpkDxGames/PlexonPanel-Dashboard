export const SCOPES = [
  "overview.view",
  "telemetry.view",
  "players.view",
  "players.location",
  "players.address",
  "console.view.errors",
  "console.view.full",
  "console.execute.allowed",
  "chat.view",
  "chat.send",
  "chat.send.minimessage",
  "player.message",
  "player.kick",
  "player.ban",
  "player.unban",
  "player.whitelist",
  "player.teleport",
  "player.gamemode",
  "player.heal",
  "player.feed",
  "player.kill",
  "player.op",
  "plugins.view",
  "plugins.config",
  "plugins.reload",
  "files.list",
  "files.read",
  "files.write",
  "files.create",
  "files.rename",
  "files.delete",
  "files.download",
  "files.upload",
  "backup.view",
  "backup.create",
  "backup.download",
  "backup.delete",
  "backup.restore",
  "server.status",
  "server.start",
  "server.stop",
  "server.restart",
  "audit.view.self",
  "audit.view",
  "devices.view",
  "devices.revoke",
  "settings.view",
] as const;
export type Scope = (typeof SCOPES)[number];
export const HIGH_RISK = new Set([
  "player.ban",
  "player.kill",
  "player.op",
  "player.deop",
  "files.delete",
  "backup.delete",
  "backup.restore",
  "server.stop",
  "server.restart",
  "devices.revoke",
]);
export const ACTION_SCOPES: Record<string, string> = Object.fromEntries(
  SCOPES.filter((s) => /^(player|files|backup|server)\./.test(s)).map((s) => [
    s,
    s,
  ]),
);
Object.assign(ACTION_SCOPES, {
  "console.execute": "console.execute.allowed",
  "chat.global.send": "chat.send",
  "player.deop": "player.op",
  "player.whitelist.add": "player.whitelist",
  "player.whitelist.remove": "player.whitelist",
  "plugin.command.reload": "plugins.reload",
  "plugin.view-configs": "plugins.config",
  "plugin.open-data-folder": "plugins.config",
  "backup.download.chunk": "backup.download",
  "backup.download.cancel": "backup.download",
  "backup.list": "backup.view",
  "backup.restore.prepare": "backup.restore",
  "audit.list": "audit.view",
  "audit.self": "audit.view.self",
  "devices.list": "devices.view",
  "devices.revoke": "devices.revoke",
  "settings.view": "settings.view",
  "files.download.chunk": "files.download",
  "files.transfer.cancel": "files.download",
});
export function validScopes(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= SCOPES.length &&
    new Set(value).size === value.length &&
    value.every(
      (s) => typeof s === "string" && (SCOPES as readonly string[]).includes(s),
    )
  );
}
export function canAction(
  action: string,
  scopes: readonly string[],
  capabilities: Record<string, boolean>,
): boolean {
  const scope = ACTION_SCOPES[action];
  return Boolean(
    scope && scopes.includes(scope) && capabilities[scope] === true,
  );
}
