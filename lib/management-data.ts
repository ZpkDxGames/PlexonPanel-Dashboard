export interface PlayerRecord {
  id: string;
  name: string;
  initials: string;
  world: string;
  role: string;
  ping: number;
  health: string;
  experienceLevel: number;
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
  status: "enabled" | "disabled";
}

export interface AuditRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  result: "success" | "blocked";
}

export interface ServerIdentityView {
  serverId: string;
  fingerprint: string;
  pluginVersion: string;
  connectionStatus: "online" | "offline";
  paired: boolean;
}

export interface AgentCapabilities {
  telemetry: boolean;
  consoleStream: boolean;
  errorCapture: boolean;
  chatStream: boolean;
  chatSend: boolean;
  remoteActions: boolean;
  consoleExecute: boolean;
  playerMessage: boolean;
  playerKick: boolean;
  playerBan: boolean;
  playerUnban: boolean;
  playerWhitelist: boolean;
}

export interface ManagementData {
  players: PlayerRecord[];
  maximumPlayers: number;
  consoleEntries: ConsoleEntry[];
  chatMessages: ChatMessage[];
  plugins: PluginRecord[];
  audit: AuditRecord[];
  identity: ServerIdentityView;
  capabilities: AgentCapabilities;
}
