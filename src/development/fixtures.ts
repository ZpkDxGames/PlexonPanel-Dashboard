import {
  emptyControlState,
  type ControlState,
  type JsonMap,
} from "../adapter/control-state";
import { SCOPES, ACTION_CONTRACT_ID } from "../adapter/scopes";
import type { ActionCompletion } from "../adapter/data-source";
export function makeFixture(mode = "healthy", now = Date.now()): ControlState {
  const state = emptyControlState("b820ad3e-02d7-4ec5-9a3d-b66fa4300c3e");
  const capturedAt = new Date(
    now + (mode === "skew" ? 12000 : mode === "stale" ? -60000 : 0),
  ).toISOString();
  const caps = Object.fromEntries(SCOPES.map((s) => [s, true]));
  state.ready = {
    serverId: state.serverId,
    protocolVersion: 3,
    version: "reference",
    actionContract: ACTION_CONTRACT_ID,
    device: {
      deviceId: "fixture-device",
      name: "Development operator",
      role: mode === "denied" ? "Viewer" : "Owner",
      scopes:
        mode === "denied" ? ["overview.view", "telemetry.view"] : [...SCOPES],
      issuedAt: now - 1000,
      expiresAt: now + 86400000,
      lastSeen: now,
    },
    agents: {
      paper: !["stopped", "offline"].includes(mode),
      host: mode !== "offline",
      hostInstalled: true,
    },
    consoleAuthority: mode === "offline" ? "UNAVAILABLE" : "HOST",
    server: {
      fingerprint: "fixture",
      serverName: "TonimSMP",
      pluginVersion: "5.0.0",
      hostVersion: "5.0.0",
      minecraftVersion: "26.3",
      capabilities: caps,
      paperCapabilities: caps,
      hostCapabilities: caps,
      paperSession: "fixture-paper",
      hostSession: "fixture-host",
      paperTargetCompatible: true,
      hostTargetCompatible: true,
      nodeId: "node-sao-01",
      instanceKey: "survival",
      fleetState: "BOUND",
    },
  };
  state.server = {
    capturedAt,
    tps: [19.87, 19.93, 19.96],
    averageTickMillis: 31.4,
    onlinePlayers: 24,
    maxPlayers: 80,
    serverName: state.ready.server.serverName,
    motd: "§bTonimSMP §7| §aSurvival §e26.3 §7· Welcome home!",
    uptimeMillis: 3 * 86400000 + 14 * 3600000 + 22 * 60000,
  };
  state.system =
    mode === "partial"
      ? {}
      : {
          capturedAt,
          processCpuPercent: 42.8,
          jvmHeapUsedBytes: 3.2 * 2 ** 30,
          jvmHeapCommittedBytes: 6 * 2 ** 30,
          jvmHeapMaximumBytes: 8 * 2 ** 30,
          gcPauseTotalMillis: 1248,
          gcCollections: 182,
        };
  state.hostSystem = {
    capturedAt: new Date(now).toISOString(),
    hostCpuPercent: 27.6,
    physicalMemoryUsedBytes: 7.8 * 2 ** 30,
    physicalMemoryTotalBytes: 16 * 2 ** 30,
  };
  state.service = {
    state: mode === "stopped" ? "inactive" : "active",
    minecraftReady: mode !== "stopped",
    resources: {
      capturedAt: new Date(now).toISOString(),
      scope: "MINECRAFT_SERVICE",
      source: "SYSTEMD_CGROUP",
      cpuAvailable: true,
      cpuUnit: "PERCENT_OF_ONE_CORE",
      cpuPercent: 146.2,
      memoryAvailable: true,
      memoryBytes: 4.1 * 2 ** 30,
    },
  };
  state.receipts = {
    paperHealth: mode === "stale" ? now - 60000 : now,
    paperSystem: now,
    hostSystem: now,
    service: now,
  };
  state.updatedAt = now;
  state.telemetryUpdatedAt = now;
  state.worlds = [
    { name: "world", loadedChunks: 682, entities: 1432 },
    { name: "world_nether", loadedChunks: 148, entities: 218 },
    { name: "world_the_end", loadedChunks: 36, entities: 42 },
  ];
  state.players = Array.from({ length: 24 }, (_, i) => ({
    uuid: `19f50206-26de-410c-a1bc-${String(i).padStart(12, "0")}`,
    name:
      [
        "AntônioNeto",
        "LumaCraft",
        "NetoBuilds",
        "EnderScout",
        "RedstoneFox",
        "MarinaMC",
      ][i % 6] + (i > 5 ? i : ""),
    world: ["world", "world_nether", "world_the_end"][i % 3],
    ping: 22 + i * 7,
    health: 20,
    onlineDurationMillis: 1000 * (500 + i * 86),
  }));
  state.plugins = [
    { name: "PlexonPanel", version: "5.0.0", enabled: true },
    { name: "LuckPerms", version: "5.4", enabled: true },
    { name: "spark", version: "1.10", enabled: true },
  ];
  state.console = Array.from({ length: 90 }, (_, i) => ({
    id: `line-${i}`,
    capturedAt: new Date(now - (90 - i) * 1700).toISOString(),
    level: i === 74 ? "WARN" : i === 85 ? "ERROR" : "INFO",
    content:
      i === 85
        ? "[WorldGuard] Task execution failed for plugin WorldGuard v7.0.12"
        : i === 86
          ? "\tat com.sk89q.worldguard.WorldGuard.tick(WorldGuard.java:42)"
          : i === 87
            ? "Caused by: java.lang.IllegalStateException: World not ready"
            : i === 88
              ? "\tat java.base/java.lang.Thread.run(Thread.java:1)"
              : i === 74
                ? "Can't keep up! Running 1241ms or 24 ticks behind"
                : i === 8
                  ? "\u001b[33m[Server thread/WARN]\u001b[0m Chunk save exceeded the target window"
                  : i === 16
                    ? "§a[Paper] §fWorld §bworld_nether §freloaded in §l842 ms"
                    : i === 24
                      ? "<aqua><bold>[PlexonPanel]</bold></aqua> <gray>Host journal stream attached</gray>"
                      : i % 9 === 0
                        ? "[Server] Saved the game"
                        : i % 7 === 0
                          ? `${["AntônioNeto", "LumaCraft", "EnderScout"][i % 3]} joined the game`
                          : i % 6 === 0
                            ? `<${["AntônioNeto", "LumaCraft", "EnderScout"][i % 3]}> Anyone up for the nether hub?`
                            : i % 5 === 0
                              ? "LumaCraft left the game"
                              : `[Server] ${["AntônioNeto", "LumaCraft", "EnderScout"][i % 3]} issued server command: /home`,
    source: "HOST",
  }));
  state.chat = [
    {
      playerName: "LumaCraft",
      message: "The new spawn looks great.",
      capturedAt: new Date(now - 14000).toISOString(),
    },
    {
      playerName: "AntônioNeto",
      message: "Thanks! Nether hub is next.",
      capturedAt: new Date(now - 12000).toISOString(),
    },
  ];
  state.history = Array.from({ length: 300 }, (_, i) => {
    const lag = i === 30 || i === 220;
    return {
      at: now - (299 - i) * 3000,
      tps: i === 140 ? null : lag ? 18.4 : 19.85 + Math.sin(i / 8) * 0.12,
      mspt:
        i === 140
          ? null
          : lag
            ? 65 + Math.sin(i) * 8
            : 28 + Math.sin(i / 13) * 7,
      hostCpu: 26 + Math.sin(i / 14) * 8,
      processCpu: 40 + Math.sin(i / 13) * 12,
      heap: (3 + Math.sin(i / 20) * 0.5) * 2 ** 30,
      memory: 7.8 * 2 ** 30,
      players: 20 + Math.min(4, Math.floor(i / 60)),
      gc: 1200 + i,
      sources: {
        paperHealth: now - (299 - i) * 3000,
        paperSystem: now - (299 - i) * 3000,
        hostSystem: now - (299 - i) * 3000,
        service: now - (299 - i) * 3000,
      },
    };
  });
  if (mode === "idle") {
    state.server = {
      ...state.server,
      tps: [20, 20, 20],
      averageTickMillis: 0.2,
      onlinePlayers: 0,
    };
    state.system = {
      ...state.system,
      processCpuPercent: 0.4,
      jvmHeapUsedBytes: 1.1 * 2 ** 30,
    };
    state.players = [];
    state.console = state.console.filter((_, i) => i < 5);
    state.chat = [];
    state.history = state.history.map((s) => ({
      ...s,
      tps: 20,
      mspt: 0.2,
      players: 0,
      processCpu: 0.4,
      heap: 1.1 * 2 ** 30,
    }));
  }
  if (mode === "stopped" || mode === "offline") {
    state.server = {};
    state.system = {};
    state.players = [];
  }
  return state;
}
let content = "view-distance: 8\nsimulation-distance: 6\nmax-players: 80\n";
let hash = "fixture-v1";
export const actionLog: { action: string; parameters: JsonMap }[] = [];
let fixtureMode = "healthy";
export function setFixtureMode(value: string) {
  fixtureMode = value;
}
export async function fixtureAction(
  action: string,
  parameters: JsonMap,
): Promise<ActionCompletion> {
  actionLog.push({ action, parameters: structuredClone(parameters) });
  await new Promise((resolve) => setTimeout(resolve, 280));
  let data: JsonMap = {
    message: "Development fixture result; no server operation was sent.",
  };
  if (action === "maintenance.status")
    data = {
      currentOperation: {
        backupId: "backup-20261010-001",
        jobId: "backup-20261010-001",
        phase: "DEGRADED",
        localBackupVerified: true,
        remoteBackupVerified: false,
        retryable: true,
        errorCode: "REMOTE_VERIFY_FAILED",
        message: "Could not verify the remote copy.",
      },
      commandChannel: { enabled: true },
    };
  if (
    action === "maintenance.settings.get" ||
    action === "maintenance.settings.update"
  )
    data = {
      settings: parameters.settings ?? {
        schemaVersion: 1,
        timezone: "America/Sao_Paulo",
        restart: {
          schedule: {
            enabled: false,
            type: "DAILY",
            weekdays: [],
            time: "04:00",
          },
          warningSeconds: [900, 300, 60, 30, 10],
          stopTimeoutSeconds: 180,
          startupTimeoutSeconds: 180,
        },
        fullRestorePoint: {
          retentionMode: "SINGLE_CURRENT",
          retentionCount: 1,
          restartAfter: true,
          canonicalFilename: "PlexonCraft-Latest.zip",
          uploadTimeoutSeconds: 1800,
          verificationMode: "SIZE_AND_HASH_WHEN_AVAILABLE",
          maximumBytes: 1099511627776,
          excludes: [
            "logs",
            "crash-reports",
            "cache",
            ".cache",
            "plugins/PlexonPanel/audit",
            "plugins/PlexonPanel/identity",
            "plugins/spark/tmp",
          ],
        },
      },
    };
  if (action === "backup.preflight")
    data = {
      hostAuthenticated: true,
      operationBusy: false,
      recoveryRequired: false,
      backupRootWritable: true,
      commandChannelConfigured: true,
      providerStatus: "CONNECTED",
      usableBytes: 42 * 2 ** 30,
      missingIncludes: [],
      symlinkIssues: [],
      unreadableDurableCount: 0,
    };
  if (action === "backup.full.list")
    data = {
      backups: [
        {
          backupId: "backup-20261010-001",
          filename: "survival-2026-10-10.tar.zst",
          timestamp: "2026-10-10T18:30:00Z",
          local: true,
          offsite: false,
          archiveBytes: 2.4 * 2 ** 30,
        },
        {
          backupId: "backup-20261009-001",
          filename: "survival-2026-10-09.tar.zst",
          timestamp: "2026-10-09T18:30:00Z",
          local: true,
          offsite: true,
          archiveBytes: 2.3 * 2 ** 30,
        },
      ],
    };
  if (action === "provider.status")
    data = {
      configured: true,
      status: "CONNECTED",
      provider: "RCLONE",
      remote: "Google Drive",
      lastTestAt: "2026-10-10T18:00:00Z",
    };
  if (action === "files.list")
    data = {
      roots: ["server"],
      entries: [
        {
          name: "paper-settings.yml",
          path: "paper-settings.yml",
          directory: false,
          editable: true,
        },
        {
          name: "permissions.json",
          path: "permissions.json",
          directory: false,
          editable: true,
        },
      ],
    };
  if (action === "files.read") data = { content, sha256: hash, editable: true };
  if (action === "files.write") {
    if (fixtureMode === "conflict" || parameters.sha256 !== hash)
      throw new Error(
        "HASH_CONFLICT: File changed on the server. Your draft is preserved.",
      );
    content = String(parameters.content);
    hash = "fixture-v2";
    data = {
      sha256: hash,
      message:
        "Saved. Application state not supplied; restart may be required.",
    };
  }
  if (action === "players.history.list")
    data = {
      entries: [
        {
          name: "LumaCraft",
          state: "JOINED",
          observedAt: "2026-10-10T18:31:04Z",
        },
      ],
      hasMore: false,
      historyEnabled: true,
    };
  if (action === "devices.list")
    data = {
      devices: [
        {
          deviceId: "fixture-device",
          name: "Development operator",
          role: "Owner",
          scopes: [...SCOPES],
        },
        {
          deviceId: "fixture-observer",
          name: "Read-only monitor",
          role: "Viewer",
          scopes: ["overview.view", "telemetry.view"],
        },
      ],
    };
  if (action.startsWith("audit."))
    data = {
      entries: [
        {
          timestamp: "2026-10-10T18:31:04Z",
          actor: "Development operator",
          action: "maintenance.full-backup.create",
          target: "Survival",
          status: "SUCCESS",
          code: "BACKUP_STARTED",
        },
        {
          timestamp: "2026-10-10T18:40:12Z",
          actor: "Host",
          action: "backup.upload",
          target: "backup-20261010-001",
          status: "DEGRADED",
          code: "REMOTE_VERIFY_FAILED",
        },
      ],
    };
  return {
    requestId: "fixture-" + crypto.randomUUID(),
    action,
    status: "SUCCESS",
    code: action === "maintenance.full-backup.create" ? "BACKUP_STARTED" : "OK",
    message: "Fixture agent response",
    data,
  };
}
