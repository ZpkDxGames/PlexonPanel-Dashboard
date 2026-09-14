import coreWorker, { PairingDirectory, ServerRoom as CoreServerRoom, currentAccess, filterEvent, validDevice, } from "./index-core.js";
import { assertFreshEnvelope, decodeEnvelope, importAgentPublicKey, verifyEnvelope, } from "./protocol.js";
export { PairingDirectory, currentAccess, filterEvent, validDevice };
function asInternals(room) {
    return room;
}
function hostSession(room) {
    const socket = room.agents("HOST")[0];
    return socket ? socket.deserializeAttachment() : null;
}
function hostConsoleAuthoritative(room, metadata) {
    const host = hostSession(room);
    return Boolean(host?.authenticated &&
        host.consoleHealthy === true &&
        metadata.hostIdentity?.capabilities["console.view.full"] === true);
}
function hostConsoleState(room) {
    const host = hostSession(room);
    if (!host?.authenticated)
        return "HOST_OFFLINE";
    return host.consoleSourceState ?? "STARTING";
}
async function announceConsoleAuthority(room, metadata) {
    await room.sendToAgent("PAPER", "console.authority", {
        hostAuthoritative: hostConsoleAuthoritative(room, metadata),
        source: "HOST_JOURNAL",
        state: hostConsoleState(room),
    });
}
function boundedText(value, maximum) {
    return typeof value === "string" && value.length > 0 && value.length <= maximum
        ? value
        : null;
}
function validateConsoleBatch(body) {
    if (!Array.isArray(body.lines) || body.lines.length > 100)
        throw new Error("Event not allowed for host console batch");
    for (const candidate of body.lines) {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
            throw new Error("Event not allowed for malformed host console line");
        const line = candidate;
        const content = boundedText(line.content, 65_536);
        const level = boundedText(line.level, 16);
        const capturedAt = boundedText(line.capturedAt, 64);
        if (!content || !capturedAt || !level || !["DEBUG", "INFO", "WARN", "ERROR", "SEVERE"].includes(level))
            throw new Error("Event not allowed for malformed host console line");
        if (line.source !== undefined && line.source !== "HOST_JOURNAL")
            throw new Error("Event not allowed for invalid host console source");
        for (const key of ["journalCursor", "invocationId", "service", "pid", "streamSession"])
            if (line[key] !== undefined && line[key] !== null && !boundedText(line[key], 4096))
                throw new Error("Event not allowed for oversized host console metadata");
        if (line.sourceSequence !== undefined &&
            (!Number.isSafeInteger(line.sourceSequence) || Number(line.sourceSequence) < 0))
            throw new Error("Event not allowed for invalid host console sequence");
    }
}
async function processHostConsole(roomObject, socket, attachment, text) {
    const room = asInternals(roomObject);
    const { envelope, body } = decodeEnvelope(text);
    assertFreshEnvelope(envelope);
    if (envelope.serverId !== attachment.serverId)
        throw new Error("Wrong room");
    if (!attachment.authenticated || attachment.kind !== "HOST")
        throw new Error("Agent authentication required");
    if (!attachment.publicKey ||
        !(await verifyEnvelope(envelope, await importAgentPublicKey(attachment.publicKey))))
        throw new Error("Invalid signature");
    if (body._session !== attachment.sessionNonce ||
        !Number.isSafeInteger(body._sequence) ||
        Number(body._sequence) <= (attachment.sequence ?? 0) ||
        attachment.recent?.includes(envelope.messageId))
        throw new Error("Session replay rejected");
    attachment.sequence = Number(body._sequence);
    attachment.recent = [...(attachment.recent ?? []), envelope.messageId].slice(-32);
    delete body._session;
    delete body._sequence;
    socket.serializeAttachment(attachment);
    const metadata = await room.metadata();
    if (attachment.publicKey !== metadata.identity?.hostPublicKey)
        throw new Error("Host authorization changed");
    if (envelope.type === "console.source") {
        const state = boundedText(body.state, 64);
        if (body.source !== "HOST_JOURNAL" || typeof body.available !== "boolean" || !state)
            throw new Error("Event not allowed for invalid console source state");
        if (body.service !== undefined && !boundedText(body.service, 128))
            throw new Error("Event not allowed for invalid console service");
        attachment.consoleHealthy = body.available === true;
        attachment.consoleSourceState = state;
        socket.serializeAttachment(attachment);
        await room.broadcastReady(metadata);
        await announceConsoleAuthority(room, metadata);
        return;
    }
    validateConsoleBatch(body);
    // SnapshotBatches intentionally emits a terminal empty batch for an empty replay. Host 3.4.0
    // can therefore send console.lines with zero lines while the Minecraft service is stopped.
    // Accept that authenticated empty snapshot as a no-op instead of tearing down the Host session.
    if (Array.isArray(body.lines) && body.lines.length === 0)
        return;
    // A freshly authenticated Host 3.4.0 can replay buffered lines immediately before its
    // console.source status reaches the relay. Treat that valid ordering race as a bounded drop,
    // not a protocol violation that tears down the authenticated Host session.
    if (attachment.consoleHealthy !== true)
        return;
    const hostCanView = metadata.hostIdentity?.capabilities["console.view.full"] === true ||
        metadata.hostIdentity?.capabilities["console.view.errors"] === true;
    if (!hostCanView)
        throw new Error("Event not allowed while host console capability is disabled");
    // When Host local policy does not allow full-console authority, Paper remains the live producer
    // while online. Host still serves its allowed output while Paper is offline.
    if (room.agents("PAPER").length > 0 && !hostConsoleAuthoritative(room, metadata))
        return;
    for (const peer of room.state.getWebSockets("dashboard")) {
        const dashboard = peer.deserializeAttachment();
        if (!currentAccess(metadata, dashboard.access))
            continue;
        const filtered = filterEvent("console.lines", body, dashboard.access?.scopes ?? [], metadata.hostIdentity?.capabilities ?? {});
        if (!filtered)
            continue;
        room.safeDashboardSend(peer, {
            type: "server.event",
            serverId: attachment.serverId,
            agentKind: "HOST",
            agentSession: attachment.sessionNonce,
            agentSequence: attachment.sequence,
            eventType: "console.lines",
            body: filtered,
            receivedAt: new Date().toISOString(),
        }, dashboard);
    }
}
const corePrototype = CoreServerRoom.prototype;
const coreAgentMessage = corePrototype.agentMessage;
const coreDashboardMessage = corePrototype.dashboardMessage;
const coreReady = corePrototype.ready;
const coreDisconnected = corePrototype.disconnected;
export class ServerRoom extends CoreServerRoom {
}
const adapterPrototype = ServerRoom.prototype;
adapterPrototype.agentMessage = async function (socket, attachment, text) {
    let type = "";
    try {
        type = decodeEnvelope(text).envelope.type;
    }
    catch {
        return coreAgentMessage.call(this, socket, attachment, text);
    }
    if (attachment.kind === "HOST" &&
        attachment.authenticated &&
        (type === "console.source" || type === "console.lines")) {
        await processHostConsole(this, socket, attachment, text);
        return;
    }
    await coreAgentMessage.call(this, socket, attachment, text);
    if (type === "agent.challenge_response" && attachment.kind === "PAPER" && attachment.authenticated) {
        const room = asInternals(this);
        await announceConsoleAuthority(room, await room.metadata());
    }
};
adapterPrototype.dashboardMessage = async function (socket, attachment, text) {
    if (text.length <= 65_536) {
        try {
            const message = JSON.parse(text);
            if (message.type === "dashboard.action" &&
                message.action === "console.execute" &&
                message.agentKind === "HOST") {
                socket.send(JSON.stringify({
                    type: "dashboard.action_rejected",
                    requestId: message.requestId,
                    code: "INVALID_PARAMETERS",
                    error: "Console commands are available only through the Paper agent.",
                }));
                return;
            }
        }
        catch {
            // The core parser owns normal malformed-request handling.
        }
    }
    await coreDashboardMessage.call(this, socket, attachment, text);
};
adapterPrototype.ready = function (metadata, attachment) {
    const room = asInternals(this);
    return {
        ...coreReady.call(this, metadata, attachment),
        version: "3.4.0",
        consoleAuthority: hostConsoleAuthoritative(room, metadata) ? "HOST" : "PAPER_FALLBACK",
        consoleSourceState: hostConsoleState(room),
    };
};
adapterPrototype.disconnected = async function (socket) {
    const attachment = socket.deserializeAttachment();
    await coreDisconnected.call(this, socket);
    if (attachment.kind === "HOST") {
        const room = asInternals(this);
        await announceConsoleAuthority(room, await room.metadata());
    }
};
const worker = {
    async fetch(request, env) {
        const response = await coreWorker.fetch(request, env);
        const url = new URL(request.url);
        if (request.method !== "GET" || url.pathname !== "/healthz" || !response.ok)
            return response;
        const payload = (await response.json());
        return new Response(JSON.stringify({ ...payload, version: "3.4.0" }), {
            status: response.status,
            headers: response.headers,
        });
    },
};
export default worker;
//# sourceMappingURL=index.js.map