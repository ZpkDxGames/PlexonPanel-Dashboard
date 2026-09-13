import { readFile, writeFile } from "node:fs/promises";

async function patch(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch made no changes`);
  await writeFile(path, after);
}

function once(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0)
    throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchWorker(source) {
  source = once(
    source,
    "  authenticatedAt?: number;\n  publicKey?: string;",
    "  authenticatedAt?: number;\n  consoleHealthy?: boolean;\n  consoleSourceState?: string;\n  publicKey?: string;",
    "worker attachment console state",
  );
  source = source.replaceAll('version: "3.0.2"', 'version: "3.4.0"');

  source = once(
    source,
    "      await this.broadcastReady(m);\n      if (a.kind === \"PAPER\")",
    "      await this.broadcastReady(m);\n      await this.sendConsoleAuthority(m);\n      if (a.kind === \"PAPER\")",
    "worker authenticated authority announce",
  );

  source = once(
    source,
    "    if (!AGENT_EVENTS.has(envelope.type)) return;\n    if (\n      a.kind === \"HOST\" &&\n      !new Set([\"telemetry.system\", \"service.status\", \"backup.progress\"]).has(\n        envelope.type,\n      )\n    )\n      throw new Error(\"Event not allowed for host\");",
    `    if (envelope.type === "console.source") {\n      if (a.kind !== "HOST") throw new Error("Only Host reports console source state");\n      const state = requiredText(body.state, "console source state", 64);\n      if (body.source !== "HOST_JOURNAL" || typeof body.available !== "boolean")\n        throw new Error("Invalid console source state");\n      a.consoleHealthy = body.available === true;\n      a.consoleSourceState = state;\n      socket.serializeAttachment(a);\n      await this.broadcastReady(m);\n      await this.sendConsoleAuthority(m);\n      return;\n    }\n    if (!AGENT_EVENTS.has(envelope.type)) return;\n    if (envelope.type === "console.lines") {\n      if (a.kind === "PAPER" && this.hostConsoleAuthoritative(m)) return;\n      if (a.kind === "HOST") {\n        if (a.consoleHealthy !== true) throw new Error("Host console source is unavailable");\n        const hostCanView =\n          m.hostIdentity?.capabilities["console.view.full"] === true ||\n          m.hostIdentity?.capabilities["console.view.errors"] === true;\n        if (!hostCanView) throw new Error("Host console capability is disabled");\n        if (this.agents("PAPER").length && !this.hostConsoleAuthoritative(m)) return;\n      }\n    }\n    if (\n      a.kind === "HOST" &&\n      !new Set(["telemetry.system", "service.status", "backup.progress", "console.lines"]).has(\n        envelope.type,\n      )\n    )\n      throw new Error("Event not allowed for host");`,
    "worker host console event policy",
  );

  source = once(
    source,
    "      if (action.startsWith(\"players.\") && kind !== \"PAPER\")\n        throw new Error(\"INVALID_PARAMETERS\");",
    "      if (action.startsWith(\"players.\") && kind !== \"PAPER\")\n        throw new Error(\"INVALID_PARAMETERS\");\n      if (action === \"console.execute\" && kind !== \"PAPER\")\n        throw new Error(\"INVALID_PARAMETERS\");",
    "worker console execute paper authority",
  );

  source = once(
    source,
    "      version: \"3.4.0\",\n      connectionStatus: this.agents(\"PAPER\").length ? \"online\" : \"offline\",\n      agents:",
    "      version: \"3.4.0\",\n      connectionStatus: this.agents(\"PAPER\").length ? \"online\" : \"offline\",\n      consoleAuthority: this.hostConsoleAuthoritative(m) ? \"HOST\" : \"PAPER_FALLBACK\",\n      consoleSourceState: this.hostConsoleState(),\n      agents:",
    "worker ready console authority",
  );

  source = once(
    source,
    "  private async broadcastReady(m: RoomMetadata) {",
    `  private hostConsoleAuthoritative(m: RoomMetadata): boolean {\n    const host = this.agents("HOST")[0];\n    if (!host) return false;\n    const attachment = host.deserializeAttachment() as SocketAttachment;\n    return (\n      attachment.consoleHealthy === true &&\n      m.hostIdentity?.capabilities["console.view.full"] === true\n    );\n  }\n\n  private hostConsoleState(): string {\n    const host = this.agents("HOST")[0];\n    if (!host) return "HOST_OFFLINE";\n    const attachment = host.deserializeAttachment() as SocketAttachment;\n    return attachment.consoleSourceState ?? "STARTING";\n  }\n\n  private async sendConsoleAuthority(m: RoomMetadata): Promise<void> {\n    await this.sendToAgent("PAPER", "console.authority", {\n      hostAuthoritative: this.hostConsoleAuthoritative(m),\n      source: "HOST_JOURNAL",\n      state: this.hostConsoleState(),\n    });\n  }\n\n  private async broadcastReady(m: RoomMetadata) {`,
    "worker console helper methods",
  );

  source = once(
    source,
    "    await this.broadcastReady(m);\n    if (a.kind === \"PAPER\" && !this.agents(\"PAPER\").length)",
    "    await this.broadcastReady(m);\n    await this.sendConsoleAuthority(m);\n    if (a.kind === \"PAPER\" && !this.agents(\"PAPER\").length)",
    "worker disconnect authority",
  );
  return source;
}

function patchStandalone(source) {
  source = once(
    source,
    "  authenticatedAt: number;\n  publicKey: string;",
    "  authenticatedAt: number;\n  consoleHealthy?: boolean;\n  consoleSourceState?: string;\n  publicKey: string;",
    "standalone agent session console state",
  );

  source = once(
    source,
    "      this.broadcastReady();\n      if (session.kind === \"PAPER\")",
    "      this.broadcastReady();\n      await this.sendConsoleAuthority();\n      if (session.kind === \"PAPER\")",
    "standalone authenticated authority announce",
  );

  source = once(
    source,
    "    if (!AGENT_EVENTS.has(envelope.type)) return;\n    if (\n      session.kind === \"HOST\" &&\n      !new Set([\"telemetry.system\", \"service.status\", \"backup.progress\"]).has(envelope.type)\n    )\n      throw new Error(\"Event not allowed for host\");",
    `    if (envelope.type === "console.source") {\n      if (session.kind !== "HOST") throw new Error("Only Host reports console source state");\n      const state = requiredText(body.state, "console source state", 64);\n      if (body.source !== "HOST_JOURNAL" || typeof body.available !== "boolean")\n        throw new Error("Invalid console source state");\n      session.consoleHealthy = body.available === true;\n      session.consoleSourceState = state;\n      this.broadcastReady();\n      await this.sendConsoleAuthority();\n      this.counters.messagesAccepted += 1;\n      return;\n    }\n    if (!AGENT_EVENTS.has(envelope.type)) return;\n    if (envelope.type === "console.lines") {\n      if (session.kind === "PAPER" && this.hostConsoleAuthoritative()) return;\n      if (session.kind === "HOST") {\n        if (session.consoleHealthy !== true) throw new Error("Host console source is unavailable");\n        const hostCanView =\n          this.metadata.hostIdentity?.capabilities["console.view.full"] === true ||\n          this.metadata.hostIdentity?.capabilities["console.view.errors"] === true;\n        if (!hostCanView) throw new Error("Host console capability is disabled");\n        if (this.paper?.authenticated && !this.hostConsoleAuthoritative()) return;\n      }\n    }\n    if (\n      session.kind === "HOST" &&\n      !new Set(["telemetry.system", "service.status", "backup.progress", "console.lines"]).has(envelope.type)\n    )\n      throw new Error("Event not allowed for host");`,
    "standalone host console event policy",
  );

  source = once(
    source,
    "      if (action.startsWith(\"players.\") && kind !== \"PAPER\") throw new Error(\"INVALID_PARAMETERS\");",
    "      if (action.startsWith(\"players.\") && kind !== \"PAPER\") throw new Error(\"INVALID_PARAMETERS\");\n      if (action === \"console.execute\" && kind !== \"PAPER\") throw new Error(\"INVALID_PARAMETERS\");",
    "standalone console execute paper authority",
  );

  source = source.replace('version: "3.1.0"', 'version: "3.4.0"');
  source = once(
    source,
    "      version: \"3.4.0\",\n      connectionStatus: this.paper?.authenticated ? \"online\" : \"offline\",\n      agents:",
    "      version: \"3.4.0\",\n      connectionStatus: this.paper?.authenticated ? \"online\" : \"offline\",\n      consoleAuthority: this.hostConsoleAuthoritative() ? \"HOST\" : \"PAPER_FALLBACK\",\n      consoleSourceState: this.host?.consoleSourceState ?? (this.host?.authenticated ? \"STARTING\" : \"HOST_OFFLINE\"),\n      agents:",
    "standalone ready console authority",
  );

  source = once(
    source,
    "  private broadcastReady(): void {",
    `  private hostConsoleAuthoritative(): boolean {\n    return (\n      this.host?.authenticated === true &&\n      this.host.consoleHealthy === true &&\n      this.metadata.hostIdentity?.capabilities["console.view.full"] === true\n    );\n  }\n\n  private async sendConsoleAuthority(): Promise<void> {\n    await this.sendToAgent("PAPER", "console.authority", {\n      hostAuthoritative: this.hostConsoleAuthoritative(),\n      source: "HOST_JOURNAL",\n      state: this.host?.consoleSourceState ?? (this.host?.authenticated ? "STARTING" : "HOST_OFFLINE"),\n    });\n  }\n\n  private broadcastReady(): void {`,
    "standalone console helper methods",
  );

  source = once(
    source,
    "      this.broadcastReady();\n      if (session.kind === \"PAPER\")\n        void this.sendToAgent(\"HOST\", \"paper.connection\", { connected: false });",
    "      this.broadcastReady();\n      void this.sendConsoleAuthority();\n      if (session.kind === \"PAPER\")\n        void this.sendToAgent(\"HOST\", \"paper.connection\", { connected: false });",
    "standalone disconnect authority",
  );
  return source;
}

await patch("relay/src/index.ts", patchWorker);
await patch("relay/src/standalone/room-manager.ts", patchStandalone);

const packagePath = "package.json";
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.version = "3.4.0";
packageJson.scripts["relay:dev"] = "npm run relay:worker:dev";
packageJson.scripts["relay:deploy"] = "npm run relay:worker:deploy";
packageJson.scripts["relay:worker:dev"] = "wrangler dev --config relay/wrangler.jsonc";
packageJson.scripts["relay:worker:deploy"] = "wrangler deploy --config relay/wrangler.jsonc";
packageJson.scripts["relay:standalone:dev"] = "npm run relay:build && node --watch relay/dist/standalone/server.js";
packageJson.scripts["relay:standalone:start"] = "node relay/dist/standalone/server.js";
packageJson.scripts["relay:standalone:smoke"] = "npm run relay:build && node relay/tests/standalone-smoke.mjs";
packageJson.scripts["relay:standalone:package"] = "npm run relay:build && node relay/scripts/package-standalone.mjs";
await writeFile(packagePath, JSON.stringify(packageJson, null, 2) + "\n");

const lockPath = "package-lock.json";
const lock = JSON.parse(await readFile(lockPath, "utf8"));
lock.version = lock.version ?? 3;
if (lock.packages?.[""]) lock.packages[""].version = "3.4.0";
await writeFile(lockPath, JSON.stringify(lock, null, 2) + "\n");

await patch(".github/workflows/check.yml", (source) => {
  source = source.replace('branches: [main, "agent/**"]', 'branches: [main, "agent/**", "release/**"]');
  source = once(
    source,
    "      - run: npm run relay:smoke\n      - run: npm run build",
    "      - run: npm run relay:smoke\n      - run: npm run relay:standalone:smoke\n      - run: npm run relay:standalone:package\n      - run: npm run build",
    "dashboard workflow standalone certification",
  );
  return source;
});
