import {
  applyControlMessage,
  emptyControlState,
  record,
  compatibleActionTarget,
  type ControlState,
  type JsonMap,
} from "./control-state";
import { ACTION_CONTRACT_ID, canAction } from "./scopes";
import { reconcileDeviceGrant, type DeviceGrantLike } from "./device-grant";
import {
  bindLiveSocket,
  unbindLiveSocket,
  requestLiveConnection,
  handleRelayControlMessage,
  captureActionTarget,
  sendDashboardAction,
  configureRelay,
  DashboardRequestError,
  setActionObserver,
  type ActionObservation,
  pairDashboardServer,
  logoutDashboard,
  type ActionTarget,
  type ActionCompletion,
} from "./data-source";
import {
  listRelayCredentials,
  loadRelayCredential,
  selectRelayCredential,
  loadServerLabels,
  saveServerLabel,
  type RelayCredential,
} from "./browser-store";
import { FleetFeed, type FleetSnapshot } from "./fleet-feed";
import { classifyTelemetry } from "./telemetry-freshness";
import { browserRelayConfiguration, saveRelayPreference, RelayConfigurationError, type RelayConfiguration } from "./relay-config";
import { deadlineDelay } from "./deadline";
export type Kind = "HOST" | "PAPER";
export function connectionPhaseLabel(phase: string): string {
  return ({"configuration-required": "Configure relay", "storage-error": "Browser storage blocked", revoked: "Pairing revoked or expired", incompatible: "Incompatible relay session", unpaired: "Not paired", pairing: "Pairing browser", connecting: "Connecting", reconnecting: "Reconnecting", live: "Relay connected"} as Record<string, string>)[phase] ?? phase;
}
export type SessionSnapshot = {
  initialized: boolean;
  state: ControlState;
  phase: string;
  error: string;
  revision: number;
  credentials: RelayCredential[];
  labels: Record<string, string>;
  fleet: FleetSnapshot[];
  fixture: string;
  grant: DeviceGrantLike | null;
  relay: RelayConfiguration;
  operation?: ActionObservation;
};
export type Prepared = {
  action: string;
  parameters: JsonMap;
  kind: Kind;
  target: ActionTarget;
  revision: number;
  name: string;
  subject?: string;
};
const listeners = new Set<() => void>();
let snapshot: SessionSnapshot = {
  initialized: false,
  state: emptyControlState(""),
  phase: "unpaired",
  error: "",
  revision: 0,
  credentials: [],
  labels: {},
  fleet: [],
  fixture: "",
  grant: null,
  relay: {origin: "", source: "unconfigured", error: ""},
};
let socket: WebSocket | null = null,
  retry: ReturnType<typeof setTimeout> | undefined,
  heartbeat: ReturnType<typeof setInterval> | undefined,
  handshake: ReturnType<typeof setTimeout> | undefined,
  expiry: ReturnType<typeof setTimeout> | undefined,
  publishTimer: ReturnType<typeof setTimeout> | undefined;
let raw = snapshot.state,
  stopped = false,
  attempt = 0,
  connection = 0;
const pending = new Set<string>();
const queries = new Map<string, Promise<ActionCompletion>>();
const queryTails = new Map<string, Promise<ActionCompletion>>();
let fixtureAction:
  | ((action: string, parameters: JsonMap) => Promise<ActionCompletion>)
  | undefined;
function publish(patch: Partial<SessionSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((f) => f());
}
setActionObserver((operation) => publish({ operation }));
const fleet = new FleetFeed((value) => publish({ fleet: value }));
function cleanup() {
  if (retry) clearTimeout(retry);
  if (heartbeat) clearInterval(heartbeat);
  if (handshake) clearTimeout(handshake);
  if (expiry) clearTimeout(expiry);
  if (publishTimer) clearTimeout(publishTimer);
  if (socket) {
    unbindLiveSocket(socket);
    socket.close(1000, "Scope changed");
  }
  socket = null;
  retry = heartbeat = handshake = expiry = publishTimer = undefined;
}
function flush() {
  if (publishTimer) clearTimeout(publishTimer);
  publishTimer = undefined;
  publish({ state: raw });
}
function receive(message: JsonMap) {
  if (
    message.type === "dashboard.ready" &&
    message.serverId === raw.serverId &&
    !raw.service.invocationId &&
    record(message.server).paperSession !== raw.ready?.server.paperSession
  )
    raw = { ...raw, history: [] };
  raw = applyControlMessage(raw, message);
  if (
    message.type === "dashboard.ready" ||
    !String(message.eventType).startsWith("telemetry.")
  )
    flush();
  else if (!publishTimer) publishTimer = setTimeout(flush, 500);
}
async function connect(credential: RelayCredential, revision: number) {
  const sequence = ++connection;
  if (stopped || revision !== snapshot.revision) return;
  publish({
    phase: attempt ? "reconnecting" : "connecting",
    grant: null,
    state: { ...raw, ready: null },
  });
  try {
    const grant = await requestLiveConnection(credential);
    if (stopped || revision !== snapshot.revision || sequence !== connection)
      return;
    const candidate = new WebSocket(grant.websocketUrl, [
      "plexonpanel-v3",
      `auth.${grant.token}`,
    ]);
    socket = candidate;
    const current = () =>
      !stopped &&
      revision === snapshot.revision &&
      sequence === connection &&
      socket === candidate;
    let incompatible = false;
    let expired = false;
    handshake = setTimeout(() => {
      if (current()) candidate.close(4008, "Handshake timeout");
    }, 15000);
    const checkExpiry = () => {
      if (!current()) return;
      const delay = deadlineDelay(grant.expiresAt);
      if (delay === null) {
        expired = true;
        candidate.close(4003, "Grant expired");
      } else expiry = setTimeout(checkExpiry, delay);
    };
    checkExpiry();
    candidate.onopen = () => {
      if (!current()) {
        candidate.close();
        return;
      }
      heartbeat = setInterval(() => {
        if (current() && candidate.readyState === WebSocket.OPEN)
          candidate.send(JSON.stringify({ type: "dashboard.ping" }));
      }, 20000);
    };
    candidate.onmessage = (event) => {
      if (
        !current() ||
        typeof event.data !== "string" ||
        event.data.length > 131072
      )
        return;
      try {
        const message = record(JSON.parse(event.data));
        if (message.serverId && message.serverId !== credential.serverId)
          return;
        if (message.type === "dashboard.ready") {
          const reported = record(message.device) as unknown as DeviceGrantLike;
          const effective = Array.isArray(reported.scopes)
            ? reconcileDeviceGrant(grant, reported)
            : null;
          if (
            message.protocolVersion !== 3 ||
            (message.actionContract !== undefined &&
              message.actionContract !== ACTION_CONTRACT_ID) ||
            !effective?.metadataMatches
          ) {
            incompatible = true;
            publish({
              error: "Protocol or signed grant mismatch. Actions blocked.",
            });
            candidate.close(4008, "Grant mismatch");
            return;
          }
          const server = record(message.server),
            agents = record(message.agents);
          bindLiveSocket(candidate, grant.serverId, {
            authorization: JSON.stringify({deviceId:reported.deviceId,role:reported.role,scopes:reported.scopes}),
            PAPER: JSON.stringify({
              session: server.paperSession,
              connected: agents.paper,
              compatible: server.paperTargetCompatible,
              capabilities: server.paperCapabilities,
            }),
            HOST: JSON.stringify({
              session: server.hostSession,
              connected: agents.host,
              compatible: server.hostTargetCompatible,
              capabilities: server.hostCapabilities,
            }),
          });
          if (handshake) clearTimeout(handshake);
          attempt = 0;
          publish({ phase: "live", grant, error: "" });
          if (typeof server.serverName === "string") {
            publish({
              labels: {
                ...snapshot.labels,
                [credential.serverId]: server.serverName,
              },
            });
            void saveServerLabel(credential.serverId, server.serverName).catch(
              () => {},
            );
          }
        }
        if (handleRelayControlMessage(message, candidate)) return;
        if (message.type === "relay.error") {
          publish({ error: String(message.error ?? "Relay rejected message") });
          return;
        }
        receive(message);
      } catch {
        publish({
          error: "Invalid relay message. No data from this packet was used.",
        });
      }
    };
    candidate.onerror = () => {
      if (current())
        publish({
          error:
            "Relay connection failed. Check the endpoint and allowed origins.",
        });
    };
    candidate.onclose = (event) => {
      if (heartbeat) clearInterval(heartbeat);
      if (handshake) clearTimeout(handshake);
      if (expiry) clearTimeout(expiry);
      unbindLiveSocket(candidate);
      if (!current()) return;
      socket = null;
      raw = { ...raw, ready: null, players: [], receipts: undefined };
      const closeReason = event.reason.trim();
      publish({
        state: raw,
        phase: "reconnecting",
        grant: null,
        error:
          closeReason || snapshot.error
            ? closeReason
              ? `Relay closed the live connection (${event.code}): ${closeReason}.`
              : snapshot.error
            : `Relay WebSocket closed before telemetry was ready (code ${event.code || 1006}).`,
      });
      if (incompatible) { publish({phase: "incompatible"}); return; }
      if (expired || event.code === 4003) {
        publish({
          phase: "revoked",
          error: "Device revoked or expired. Pair again.",
        });
        return;
      }
      attempt++;
      retry = setTimeout(
        () => void connect(credential, revision),
        Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)),
      );
    };
  } catch (error) {
    if (stopped || revision !== snapshot.revision || sequence !== connection) return;
    const terminal = error instanceof RelayConfigurationError ? "configuration-required" :
      error instanceof DashboardRequestError && (error.status === 401 || error.status === 403) ? "revoked" : "";
    publish({
      phase: terminal || "reconnecting",
      error: error instanceof TypeError ? "The relay could not be reached. Verify its HTTPS endpoint and allow this dashboard origin in the relay configuration." : error instanceof Error ? error.message : "Connection failed",
    });
    if (terminal) return;
    attempt++;
    retry = setTimeout(
      () => void connect(credential, revision),
      Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)),
    );
  }
}
export const session = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  async start() {
    try {
    const [credentials, selected, labels] = await Promise.all([
      listRelayCredentials(),
      loadRelayCredential(),
      loadServerLabels(),
    ]);
    const relay = browserRelayConfiguration(selected);
    publish({ credentials, labels, relay, error: relay.error, phase: relay.error ? "configuration-required" : "unpaired" });
    if (selected) await this.select(selected.serverId);
    else if (!relay.error) configureRelay(relay.origin);
    } catch (error) {
      publish({phase: "storage-error", grant: null, error: error instanceof Error ? error.message : "Browser pairing storage is unavailable."});
    } finally {
      publish({initialized: true});
    }
  },
  async select(id: string) {
    cleanup();
    fleet.updateRoster([], "");
    connection++;
    const revision = snapshot.revision + 1;
    raw = emptyControlState(id);
    publish({
      state: raw,
      revision,
      grant: null,
      phase: "connecting",
      error: "",
    });
    try { await selectRelayCredential(id); } catch (error) {
      if (snapshot.revision === revision) publish({phase: "revoked", error: error instanceof Error ? error.message : "Stored pairing unavailable."});
      return;
    }
    if (snapshot.revision !== revision) return;
    const credential = snapshot.credentials.find((c) => c.serverId === id);
    if (!credential) { publish({phase: "unpaired", error: "The stored pairing is unavailable. Pair this browser again."}); return; }
    const relay = browserRelayConfiguration(credential);
    publish({relay});
    if (relay.error) { publish({phase: "configuration-required", error: relay.error}); return; }
    configureRelay(relay.origin);
    fleet.updateRoster(snapshot.credentials, id);
    stopped = false;
    attempt = 0;
    void connect(credential, revision);
  },
  async pair(origin: string, code: string, name: string) {
    saveRelayPreference(origin);
    cleanup();
    fleet.updateRoster([], "");
    connection++;
    raw = {...raw, ready: null, players: [], receipts: undefined};
    const relay = browserRelayConfiguration();
    configureRelay(relay.origin);
    publish({relay, state: raw, grant: null, revision: snapshot.revision + 1, phase: "pairing", error: ""});
    try { await pairDashboardServer(code, name); } catch (error) {
      publish({phase: "unpaired", error: error instanceof Error ? error.message : "Pairing failed."});
      throw error;
    }
    const credentials = await listRelayCredentials();
    publish({ credentials });
    const selected = await loadRelayCredential();
    if (selected) await this.select(selected.serverId);
  },
  async setRelayOrigin(origin: string | null) {
    saveRelayPreference(origin);
    const id = snapshot.state.serverId;
    if (id) await this.select(id);
    else {
      const relay = browserRelayConfiguration();
      publish({relay, phase: relay.error ? "configuration-required" : "unpaired", error: relay.error});
      if (!relay.error) configureRelay(relay.origin);
    }
  },
  async remove() {
    cleanup();
    await logoutDashboard(snapshot.state.serverId);
    raw = emptyControlState("");
    publish({
      state: raw,
      phase: "unpaired",
      grant: null,
      credentials: await listRelayCredentials(),
      revision: snapshot.revision + 1,
    });
    fleet.updateRoster(snapshot.credentials, "");
  },
  reconnect() {
    const id = snapshot.state.serverId;
    if (id) void this.select(id);
  },
  reason(action: string, kind: Kind): string {
    const ready = raw.ready;
    if (!ready || snapshot.phase !== "live")
      return "Connect this server to enable actions.";
    const grant = reconcileDeviceGrant(snapshot.grant, ready.device);
    if (!grant) return "The signed device grant is unavailable.";
    if (
      ready.actionContract !== undefined &&
      ready.actionContract !== ACTION_CONTRACT_ID
    )
      return "Action contract mismatch.";
    if (!compatibleActionTarget(ready, kind))
      return `${kind} instance association is incomplete.`;
    if (!ready.agents[kind === "HOST" ? "host" : "paper"])
      return `${kind === "HOST" ? "Host" : "Paper"} is offline.`;
    if (kind === "HOST" && (action === "server.start" || action === "server.stop")) {
      const current = classifyTelemetry({ capturedAt: record(raw.service.resources).capturedAt ?? raw.service.capturedAt, receivedAt: raw.receipts?.service, connected: true, now: Date.now() });
      if (!current.usable) return "Wait for current Host service evidence before starting or stopping.";
      if (action === "server.start" && !["inactive", "failed"].includes(String(raw.service.state))) return "Start requires a confirmed stopped service.";
      if (action === "server.stop" && raw.service.state !== "active") return "Stop requires a confirmed active service.";
    }
    if (
      (action === "player.op" ||
        action === "player.deop" ||
        action.startsWith("backup.restore")) &&
      grant.role !== "Owner"
    )
      return "Owner authority required.";
    return canAction(
      action,
      grant.scopes,
      kind === "HOST"
        ? ready.server.hostCapabilities
        : ready.server.paperCapabilities,
    )
      ? ""
      : "The device scope or server policy does not permit this action.";
  },
  prepare(action: string, parameters: JsonMap, kind: Kind): Prepared {
    const reason = this.reason(action, kind);
    if (reason) throw new Error(reason);
    return {
      action,
      parameters: structuredClone(parameters),
      kind,
      target: snapshot.fixture
        ? {
            serverId: raw.serverId,
            generation: String(snapshot.revision),
            agentKind: kind,
          }
        : captureActionTarget(raw.serverId, kind),
      revision: snapshot.revision,
      name: String(raw.ready?.server.serverName ?? raw.serverId),
      subject:
        typeof parameters.playerId === "string"
          ? String(
              raw.players.find((p) => p.uuid === parameters.playerId)?.name ??
                "Unknown player",
            )
          : typeof parameters.path === "string"
            ? parameters.path
            : typeof parameters.backupId === "string"
              ? parameters.backupId
              : undefined,
    };
  },
  valid(prepared: Prepared) {
    if (
      prepared.revision !== snapshot.revision ||
      prepared.target.serverId !== raw.serverId ||
      this.reason(prepared.action, prepared.kind)
    )
      return false;
    try {
      return (
        snapshot.fixture ||
        captureActionTarget(raw.serverId, prepared.kind).generation ===
          prepared.target.generation
      );
    } catch {
      return false;
    }
  },
  async execute(prepared: Prepared, confirmed = false) {
    if (!this.valid(prepared))
      throw new Error("The target or authority changed. Review again.");
    const key = `${prepared.target.serverId}:${prepared.action}`;
    if (pending.has(key))
      throw new Error("This operation is already in progress.");
    pending.add(key);
    try {
      const result =
        snapshot.fixture && fixtureAction
          ? await fixtureAction(prepared.action, prepared.parameters)
          : await sendDashboardAction(
              prepared.action,
              {
                ...prepared.parameters,
                ...(confirmed ? { confirmed: true } : {}),
              },
              prepared.kind,
              prepared.target,
            );
      if (!this.valid(prepared))
        throw new Error(
          "Connection changed. Outcome unknown; check the agent audit before retrying.",
        );
      return result;
    } finally {
      pending.delete(key);
    }
  },
  async query(action: string, parameters: JsonMap = {}, kind: Kind = "PAPER") {
    const prepared = this.prepare(action, parameters, kind);
    const key = `${snapshot.revision}:${kind}:${action}:${JSON.stringify(parameters)}`;
    const existing = queries.get(key); if(existing)return existing;
    // Differing read parameters share the existing per-action execution lane.
    // execute revalidates the authority and target captured before queueing.
    const lane=`${prepared.target.serverId}:${action}`, previous=queryTails.get(lane);
    const response=(previous?previous.catch(()=>undefined):Promise.resolve()).then(()=>this.execute(prepared));
    queries.set(key,response);queryTails.set(lane,response);
    try{return await response;}finally{if(queries.get(key)===response)queries.delete(key);if(queryTails.get(lane)===response)queryTails.delete(lane);}

  },
  installFixture(
    name: string,
    state: ControlState,
    action: (a: string, p: JsonMap) => Promise<ActionCompletion>,
  ) {
    cleanup();
    fleet.close();
    raw = state;
    fixtureAction = action;
    publish({
      initialized: true,
      fixture: name,
      state,
      revision: snapshot.revision + 1,
      phase: "live",
      grant: state.ready?.device ?? null,
    });
  },
  receiveFixture(message: JsonMap) {
    if (snapshot.fixture) receive(message);
  },
  close() {
    stopped = true;
    connection++;
    cleanup();
    fleet.close();
  },
};
