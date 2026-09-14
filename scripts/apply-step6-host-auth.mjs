import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, oldText, newText) {
  const text = await readFile(path, "utf8");
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`anchor not found in ${path}: ${oldText.slice(0, 100)}`);
  if (text.indexOf(oldText, first + 1) >= 0) throw new Error(`anchor is not unique in ${path}`);
  await writeFile(path, text.slice(0, first) + newText + text.slice(first + oldText.length));
}

const worker = "relay/src/index-core.ts";
await replaceOnce(
  worker,
  `      await this.state.storage.put(METADATA_KEY, m);\n      this.closeInvalid(m);\n      await this.scheduleExpiry(m);\n      await this.broadcastReady(m);\n      return;\n    }\n    if (envelope.type === "backup.coordination") {`,
  `      await this.state.storage.put(METADATA_KEY, m);\n      this.closeInvalid(m);\n      await this.scheduleExpiry(m);\n      await this.broadcastReady(m);\n      if (a.kind === "PAPER")\n        await this.sendToAgent("HOST", "access.authority.sync", body);\n      return;\n    }\n    if (envelope.type === "access.authority.sync")\n      throw new Error("Only relay emits Host authorization snapshots");\n    if (envelope.type === "access.authority.request") {\n      if (a.kind !== "HOST") throw new Error("Only Host requests access authority refresh");\n      if (Object.keys(body).length !== 0) throw new Error("Invalid access authority request");\n      await this.sendToAgent("PAPER", "access.authority.request", {});\n      return;\n    }\n    if (envelope.type === "backup.coordination") {`,
);

const standalone = "relay/src/standalone/room-manager-core.ts";
await replaceOnce(
  standalone,
  `    if (envelope.type === "access.sync") {\n      this.applyAccessSync(session, body);\n      this.counters.messagesAccepted += 1;\n      return;\n    }\n    if (envelope.type === "backup.coordination") {`,
  `    if (envelope.type === "access.sync") {\n      this.applyAccessSync(session, body);\n      if (session.kind === "PAPER")\n        await this.sendToAgent("HOST", "access.authority.sync", body);\n      this.counters.messagesAccepted += 1;\n      return;\n    }\n    if (envelope.type === "access.authority.sync")\n      throw new Error("Only relay emits Host authorization snapshots");\n    if (envelope.type === "access.authority.request") {\n      if (session.kind !== "HOST") throw new Error("Only Host requests access authority refresh");\n      if (Object.keys(body).length !== 0) throw new Error("Invalid access authority request");\n      await this.sendToAgent("PAPER", "access.authority.request", {});\n      this.counters.messagesAccepted += 1;\n      return;\n    }\n    if (envelope.type === "backup.coordination") {`,
);

const roomTest = "relay/tests/room.test.mjs";
let room = await readFile(roomTest, "utf8");
room += `\n\ntest("Paper access sync is mirrored to Host and Host can request a refresh", async () => {\n  const f = await fixture();\n  const paper = await attach(f, "PAPER");\n  const host = await attach(f, "HOST");\n  paper.socket.sent.length = 0;\n  host.socket.sent.length = 0;\n\n  const snapshot = {\n    protocolVersion: 3,\n    serverId: f.serverId,\n    generation: 7,\n    revision: 2,\n    devices: [f.d],\n  };\n  await paper.send("access.sync", snapshot);\n  const mirroredEnvelope = host.socket.sent.find((message) => message.type === "access.authority.sync");\n  assert.ok(mirroredEnvelope, "Host must receive the validated Paper access snapshot");\n  const mirrored = decodeEnvelope(JSON.stringify(mirroredEnvelope)).body;\n  assert.equal(mirrored.serverId, f.serverId);\n  assert.equal(mirrored.generation, 7);\n  assert.equal(mirrored.revision, 2);\n  assert.equal(mirrored.devices[0].deviceId, f.d.deviceId);\n\n  paper.socket.sent.length = 0;\n  await host.send("access.authority.request", {});\n  const refreshEnvelope = paper.socket.sent.find((message) => message.type === "access.authority.request");\n  assert.ok(refreshEnvelope, "Paper must receive Host's refresh request");\n  assert.deepEqual(decodeEnvelope(JSON.stringify(refreshEnvelope)).body, {});\n});\n\ntest("Paper cannot forge Host authorization control messages and access sync tolerates Host offline", async () => {\n  const f = await fixture();\n  const paper = await attach(f, "PAPER");\n  await paper.send("access.sync", {\n    protocolVersion: 3,\n    serverId: f.serverId,\n    generation: 7,\n    revision: 2,\n    devices: [f.d],\n  });\n  assert.equal(paper.socket.closed, null);\n  assert.equal((await f.st.storage.get("room-metadata")).revision, 2);\n\n  await paper.send("access.authority.request", {});\n  assert.equal(paper.socket.closed?.code, 4008);\n\n  const other = await fixture();\n  const paper2 = await attach(other, "PAPER");\n  await paper2.send("access.authority.sync", {\n    protocolVersion: 3,\n    serverId: other.serverId,\n    generation: 7,\n    revision: 2,\n    devices: [other.d],\n  });\n  assert.equal(paper2.socket.closed?.code, 4008);\n});\n`;
await writeFile(roomTest, room);

const preflight = "relay/tests/preflight-contract.test.mjs";
await replaceOnce(
  preflight,
  `  room.host = hostSession;\n  room.paper = { ...hostSession, socket: paperSocket, kind: "PAPER", publicKey: paperKey.publicKey };\n`,
  `  room.host = hostSession;\n  const paperSession = {\n    ...hostSession,\n    socket: paperSocket,\n    kind: "PAPER",\n    publicKey: paperKey.publicKey,\n    sessionNonce: randomUUID(),\n    sequence: 0,\n    recent: [],\n    chain: Promise.resolve(),\n  };\n  room.paper = paperSession;\n`,
);
await replaceOnce(
  preflight,
  `  return { directory, store, room, serverId, device, browser, other, hostSession, hostSocket, hostKey };\n}\n`,
  `  return { directory, store, room, serverId, device, browser, other, hostSession, hostSocket, hostKey, paperSession, paperSocket, paperKey };\n}\n`,
);
let contract = await readFile(preflight, "utf8");
contract += `\n\ntest("standalone relay mirrors Paper authorization to Host and enforces refresh direction", async () => {\n  const f = await standaloneFixture();\n  try {\n    const snapshot = {\n      protocolVersion: 3,\n      serverId: f.serverId,\n      generation: 7,\n      revision: 3,\n      devices: [f.device],\n      _session: f.paperSession.sessionNonce,\n      _sequence: 1,\n    };\n    const sync = await signEnvelope("access.sync", f.serverId, snapshot, f.paperKey.privateKey);\n    await f.room.agentMessage(f.paperSession, sync);\n    const mirroredEnvelope = f.hostSocket.sent.find((message) => message.type === "access.authority.sync");\n    assert.ok(mirroredEnvelope, "standalone Host must receive Paper access authority");\n    const mirrored = decodeEnvelope(JSON.stringify(mirroredEnvelope)).body;\n    assert.equal(mirrored.revision, 3);\n    assert.equal(mirrored.devices[0].deviceId, f.device.deviceId);\n\n    f.paperSocket.sent.length = 0;\n    const request = await signEnvelope(\n      "access.authority.request",\n      f.serverId,\n      { _session: f.hostSession.sessionNonce, _sequence: 1 },\n      f.hostKey.privateKey,\n    );\n    await f.room.agentMessage(f.hostSession, request);\n    const refresh = f.paperSocket.sent.find((message) => message.type === "access.authority.request");\n    assert.ok(refresh, "standalone Paper must receive Host refresh request");\n\n    const forgedRequest = await signEnvelope(\n      "access.authority.request",\n      f.serverId,\n      { _session: f.paperSession.sessionNonce, _sequence: 2 },\n      f.paperKey.privateKey,\n    );\n    await assert.rejects(\n      f.room.agentMessage(f.paperSession, forgedRequest),\n      /Only Host requests access authority refresh/,\n    );\n  } finally {\n    clearTimeout(f.hostSession.authTimer);\n    f.store.close();\n    await rm(f.directory, { recursive: true, force: true });\n  }\n});\n`;
await writeFile(preflight, contract);

const protocol = "docs/PROTOCOL.md";
await replaceOnce(
  protocol,
  `Paper remains authoritative for full access synchronization. It publishes \`access.sync\` after a newly authenticated relay session and after real local access mutations. A Dashboard \`gateway.snapshot_request\` refreshes telemetry/console snapshots only and does not re-run access synchronization.\n`,
  `Paper remains authoritative for full access synchronization. It publishes \`access.sync\` after a newly authenticated relay session and after real local access mutations. After validating and persisting a Paper snapshot, the relay best-effort forwards it to an authenticated Host as relay-signed \`access.authority.sync\`. Host may send \`access.authority.request\`; the relay accepts that message only from authenticated Host and asks authenticated Paper to republish \`access.sync\`. These internal messages do not mint grants, alter generation/revision, or expose credentials. A Dashboard \`gateway.snapshot_request\` refreshes telemetry/console snapshots only and does not re-run access synchronization.\n`,
);

const ops = "docs/OPERATIONS.md";
let operations = await readFile(ops, "utf8");
operations += `\n\n## Host authorization while Paper is offline\n\nPairing and revocation remain Paper-authoritative. The relay persists only bounded coordination metadata and forwards validated Paper access snapshots to the authenticated Host. Host stores its own restrictive local mirror, so an already paired browser can continue to use Host-backed backup, provider, console and systemd controls while Paper/Minecraft is stopped. New pairing and access mutation still require Paper. A Host refresh request is best-effort: if Paper is offline, the last valid Host mirror remains in force; stale or malformed snapshots never replace it.\n`;
await writeFile(ops, operations);

console.log("Step 6 dashboard/relay patch applied");
