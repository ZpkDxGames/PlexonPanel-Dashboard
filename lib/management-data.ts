export interface PlayerRecord {
  id: string;
  name: string;
  initials: string;
  world: string;
  role: "Owner" | "Moderator" | "Player";
  ping: number;
  playTime: string;
  joined: string;
  color: string;
}

export interface ConsoleEntry {
  id: string;
  time: string;
  level: "INFO" | "WARN" | "ERROR";
  source: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  player: string;
  initials: string;
  role?: string;
  channel: "Global" | "Staff";
  message: string;
  time: string;
  color: string;
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  status: "enabled" | "disabled" | "update";
  nextVersion?: string;
}

export interface AuditRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  result: "success" | "blocked";
}

export const demoPlayers: PlayerRecord[] = [
  { id: "player-01", name: "NovaFox", initials: "NF", world: "Lobby", role: "Moderator", ping: 34, playTime: "18h 42m", joined: "2 min ago", color: "violet" },
  { id: "player-02", name: "PixelRaven", initials: "PR", world: "Survival", role: "Player", ping: 48, playTime: "7h 11m", joined: "16 min ago", color: "cyan" },
  { id: "player-03", name: "CraftedSky", initials: "CS", world: "Skyblock", role: "Player", ping: 61, playTime: "31h 08m", joined: "28 min ago", color: "green" },
  { id: "player-04", name: "ZpkDx", initials: "ZD", world: "Lobby", role: "Owner", ping: 22, playTime: "94h 20m", joined: "1h ago", color: "amber" },
  { id: "player-05", name: "EnderVale", initials: "EV", world: "Survival", role: "Player", ping: 85, playTime: "3h 56m", joined: "1h ago", color: "rose" },
  { id: "player-06", name: "RedstoneKit", initials: "RK", world: "Creative", role: "Player", ping: 43, playTime: "14h 03m", joined: "2h ago", color: "cyan" },
  { id: "player-07", name: "MossyByte", initials: "MB", world: "Survival", role: "Player", ping: 38, playTime: "11h 49m", joined: "2h ago", color: "green" },
  { id: "player-08", name: "LunarPick", initials: "LP", world: "Skyblock", role: "Player", ping: 109, playTime: "5h 20m", joined: "3h ago", color: "violet" },
];

export const demoConsoleEntries: ConsoleEntry[] = [
  { id: "log-01", time: "18:42:06", level: "INFO", source: "Server", message: "NovaFox joined the game" },
  { id: "log-02", time: "18:42:07", level: "INFO", source: "PlexonPanel", message: "Published telemetry snapshot in 14ms" },
  { id: "log-03", time: "18:42:11", level: "INFO", source: "PlexonChats", message: "[Global] NovaFox: anyone up for the new dungeon?" },
  { id: "log-04", time: "18:42:18", level: "WARN", source: "Server", message: "Can't keep up! Running 1248ms or 24 ticks behind" },
  { id: "log-05", time: "18:42:20", level: "INFO", source: "WorldGuard", message: "Region data saved for world_survival" },
  { id: "log-06", time: "18:42:24", level: "INFO", source: "Server", message: "ThreadedAnvilChunkStorage: All dimensions are saved" },
  { id: "log-07", time: "18:42:31", level: "ERROR", source: "ExamplePlugin", message: "Task #422 generated an exception: timed out after 5000ms" },
  { id: "log-08", time: "18:42:32", level: "INFO", source: "PlexonPanel", message: "Error fingerprint recorded for dashboard review" },
  { id: "log-09", time: "18:42:39", level: "INFO", source: "Server", message: "PixelRaven issued server command: /spawn" },
];

export const demoChatMessages: ChatMessage[] = [
  { id: "chat-01", player: "NovaFox", initials: "NF", role: "Mod", channel: "Global", message: "Anyone up for the new dungeon? We need one more.", time: "18:41", color: "violet" },
  { id: "chat-02", player: "PixelRaven", initials: "PR", channel: "Global", message: "I can join after I drop these resources at spawn.", time: "18:41", color: "cyan" },
  { id: "chat-03", player: "CraftedSky", initials: "CS", channel: "Global", message: "The east portal is open again, by the way.", time: "18:42", color: "green" },
  { id: "chat-04", player: "PlexonPanel", initials: "PP", role: "System", channel: "Global", message: "Scheduled restart begins in 45 minutes.", time: "18:42", color: "system" },
  { id: "chat-05", player: "ZpkDx", initials: "ZD", role: "Owner", channel: "Global", message: "Restart should only take a minute. Inventories are safe.", time: "18:43", color: "amber" },
];

export const demoPlugins: PluginRecord[] = [
  { id: "plugin-01", name: "PlexonPanel", version: "0.1.0", author: "ZpkDxGames", description: "Secure remote monitoring and server administration.", status: "enabled" },
  { id: "plugin-02", name: "PlexonChats", version: "2.4.1", author: "ZpkDxGames", description: "Channels, formatting, and global chat controls.", status: "enabled" },
  { id: "plugin-03", name: "LuckPerms", version: "5.4.145", author: "Luck", description: "Permissions management for server networks.", status: "update", nextVersion: "5.5.2" },
  { id: "plugin-04", name: "ViaVersion", version: "5.4.2", author: "ViaVersion", description: "Allows newer clients to join older server versions.", status: "enabled" },
  { id: "plugin-05", name: "WorldEdit", version: "7.3.8", author: "EngineHub", description: "Fast in-game map editing and generation tools.", status: "enabled" },
  { id: "plugin-06", name: "WorldGuard", version: "7.0.13", author: "EngineHub", description: "Protects areas and configures world behavior.", status: "enabled" },
  { id: "plugin-07", name: "spark", version: "1.10.146", author: "Luck", description: "Performance profiling and server health insights.", status: "enabled" },
  { id: "plugin-08", name: "Maintenance", version: "4.3.0", author: "kennytv", description: "Controls network access during maintenance windows.", status: "disabled" },
];

export const demoAudit: AuditRecord[] = [
  { id: "audit-01", actor: "Administrator", action: "Opened console session", target: "Plexon Network", time: "19 min ago", result: "success" },
  { id: "audit-02", actor: "Administrator", action: "Updated remote-action policy", target: "Player messages", time: "2h ago", result: "success" },
  { id: "audit-03", actor: "Unknown session", action: "Attempted console command", target: "Plexon Network", time: "Yesterday", result: "blocked" },
  { id: "audit-04", actor: "Administrator", action: "Paired server identity", target: "Lobby EU-01", time: "3 days ago", result: "success" },
];
