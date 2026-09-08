from pathlib import Path


def replace(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, count)


relay_path = Path("relay/src/index.ts")
relay = relay_path.read_text()
if "private safeDashboardSend(" in relay and 'version: "3.0.2"' in relay:
    print("3.0.2 relay reliability patch already applied")
    raise SystemExit(0)

relay = replace(
    relay,
    "  authenticated?: boolean;\n  publicKey?: string;",
    "  authenticated?: boolean;\n  authenticatedAt?: number;\n  publicKey?: string;",
    "attachment authenticatedAt",
)

relay = replace(
    relay,
    '''        } catch {\n          if (a.role === "agent")\n            socket.close(4008, "Protocol message rejected");\n          else\n            socket.send(\n              JSON.stringify({\n                type: "relay.error",\n                code: "INVALID_REQUEST",\n                error: "The request was rejected.",\n              }),\n            );\n        }''',
    '''        } catch (error) {\n          if (a.role === "agent") {\n            const code = protocolRejectionCode(error, a.authenticated === true);\n            this.recordDiagnostic(\n              code ?? "INTERNAL_POST_AUTH_FAILURE",\n              a,\n              messageTypeHint(message),\n            );\n            if (code || !a.authenticated)\n              this.safeClose(\n                socket,\n                4008,\n                `Protocol message rejected: ${code ?? "INVALID_ENVELOPE"}`,\n              );\n          } else {\n            this.safeDashboardSend(\n              socket,\n              {\n                type: "relay.error",\n                code: "INVALID_REQUEST",\n                error: "The request was rejected.",\n              },\n              a,\n            );\n          }\n        }''',
    "websocket error isolation",
)

relay = replace(
    relay,
    "      a.authenticated = true;\n      delete a.challenge;",
    "      a.authenticated = true;\n      a.authenticatedAt = Date.now();\n      delete a.challenge;",
    "authenticated timestamp",
)

relay = replace(
    relay,
    '''      await this.sendGateway(socket, a.serverId, "gateway.authenticated", {\n        protocolVersion: 3,\n        paired: m.paired,\n        authenticatedAt: new Date().toISOString(),\n      });\n      await this.broadcastReady(m);\n      if (a.kind === "PAPER")\n        await this.sendToAgent("HOST", "paper.connection", { connected: true });\n      if (a.kind === "HOST")\n        await this.sendGateway(socket, a.serverId, "paper.connection", {\n          connected: this.agents("PAPER").length > 0,\n        });''',
    '''      if (\n        !(await this.sendGatewaySafely(\n          socket,\n          a.serverId,\n          "gateway.authenticated",\n          {\n            protocolVersion: 3,\n            paired: m.paired,\n            authenticatedAt: new Date().toISOString(),\n          },\n          a,\n        ))\n      )\n        return;\n      await this.broadcastReady(m);\n      if (a.kind === "PAPER")\n        await this.sendToAgent("HOST", "paper.connection", { connected: true });\n      if (a.kind === "HOST")\n        await this.sendGatewaySafely(\n          socket,\n          a.serverId,\n          "paper.connection",\n          { connected: this.agents("PAPER").length > 0 },\n          a,\n        );''',
    "post-auth delivery isolation",
)

relay = replace(
    relay,
    '''      // HOST reads the same local registry, but may only remove grants. New grants originate from PAPER.\n      const next = body.devices as Device[];\n      if (\n        a.kind === "HOST" &&\n        (Number(body.generation) !== m.generation ||\n          next.some((d) => !m.devices.some((old) => sameDevice(old, d))))\n      )\n        throw new Error("Host cannot issue device grants");''',
    '''      // HOST reads the same local registry, but may only remove grants. New grants originate from PAPER.\n      // Safe Host divergence is a reconciliation conflict, not transport corruption.\n      const next = body.devices as Device[];\n      if (\n        a.kind === "HOST" &&\n        (Number(body.generation) !== m.generation ||\n          next.some((d) => !m.devices.some((old) => sameDevice(old, d))))\n      ) {\n        this.recordDiagnostic("HOST_GRANT_CONFLICT", a, envelope.type);\n        return;\n      }''',
    "host access reconciliation",
)

relay = replace(
    relay,
    '''        if (\n          access.deviceId === pending.deviceId &&\n          currentAccess(m, access.access)\n        )\n          peer.send(\n            JSON.stringify({\n              type: "server.event",\n              serverId: a.serverId,\n              agentKind: a.kind,\n              eventType: "action.result",\n              body,\n              receivedAt: new Date().toISOString(),\n            }),\n          );''',
    '''        if (\n          access.deviceId === pending.deviceId &&\n          currentAccess(m, access.access)\n        )\n          this.safeDashboardSend(\n            peer,\n            {\n              type: "server.event",\n              serverId: a.serverId,\n              agentKind: a.kind,\n              eventType: "action.result",\n              body,\n              receivedAt: new Date().toISOString(),\n            },\n            access,\n          );''',
    "action result dashboard fanout",
)

relay = replace(
    relay,
    '''      if (filtered)\n        peer.send(\n          JSON.stringify({\n            type: "server.event",\n            serverId: a.serverId,\n            agentKind: a.kind,\n            agentSession: a.sessionNonce,\n            agentSequence: a.sequence,\n            eventType: envelope.type,\n            body: filtered,\n            receivedAt: new Date().toISOString(),\n          }),\n        );''',
    '''      if (filtered)\n        this.safeDashboardSend(\n          peer,\n          {\n            type: "server.event",\n            serverId: a.serverId,\n            agentKind: a.kind,\n            agentSession: a.sessionNonce,\n            agentSequence: a.sequence,\n            eventType: envelope.type,\n            body: filtered,\n            receivedAt: new Date().toISOString(),\n          },\n          d,\n        );''',
    "event dashboard fanout",
)

relay = replace(
    relay,
    '''      socket.send(JSON.stringify(this.ready(metadata, attachment)));\n      await this.sendToAgent("PAPER", "gateway.snapshot_request", {});''',
    '''      this.safeDashboardSend(socket, this.ready(metadata, attachment), attachment);\n      await this.sendToAgent("PAPER", "gateway.snapshot_request", {});''',
    "initial dashboard ready",
)

# Pairing claims must notice a failed Paper destination even though peer send failures are isolated.
relay = replace(
    relay,
    '''          void this.sendToAgent("PAPER", "pairing.consume", {\n            requestId: pending.requestId,\n            deviceId,\n            name,\n          }).catch(() => {\n            clearTimeout(timer);\n            this.pairingWaiters.delete(pending.requestId);\n            resolve(null);\n          });''',
    '''          void this.sendToAgent("PAPER", "pairing.consume", {\n            requestId: pending.requestId,\n            deviceId,\n            name,\n          }).then((sent) => {\n            if (sent) return;\n            clearTimeout(timer);\n            this.pairingWaiters.delete(pending.requestId);\n            resolve(null);\n          });''',
    "pairing peer failure handling",
)

relay = replace(
    relay,
    '''  private async sendToAgent(\n    kind: AgentKind,\n    type: string,\n    body: Record<string, unknown>,\n  ) {\n    const s = this.agents(kind)[0];\n    if (s)\n      await this.sendGateway(\n        s,\n        (s.deserializeAttachment() as SocketAttachment).serverId,\n        type,\n        body,\n      );\n  }''',
    '''  private async sendGatewaySafely(\n    socket: WebSocket,\n    serverId: string,\n    type: string,\n    body: Record<string, unknown>,\n    attachment?: SocketAttachment,\n  ): Promise<boolean> {\n    try {\n      await this.sendGateway(socket, serverId, type, body);\n      return true;\n    } catch {\n      const a =\n        attachment ?? (socket.deserializeAttachment() as SocketAttachment);\n      this.recordDiagnostic("PEER_DELIVERY_FAILED", a, type);\n      if (a.role === "agent") {\n        a.authenticated = false;\n        socket.serializeAttachment(a);\n      }\n      this.safeClose(socket, 1011, "Agent transport delivery failed");\n      return false;\n    }\n  }\n  private async sendToAgent(\n    kind: AgentKind,\n    type: string,\n    body: Record<string, unknown>,\n  ): Promise<boolean> {\n    const s = this.agents(kind)[0];\n    if (!s) return false;\n    const a = s.deserializeAttachment() as SocketAttachment;\n    return this.sendGatewaySafely(s, a.serverId, type, body, a);\n  }\n  private safeDashboardSend(\n    socket: WebSocket,\n    payload: Record<string, unknown>,\n    attachment?: SocketAttachment,\n  ): boolean {\n    try {\n      socket.send(JSON.stringify(payload));\n      return true;\n    } catch {\n      const a =\n        attachment ?? (socket.deserializeAttachment() as SocketAttachment);\n      this.recordDiagnostic(\n        "DASHBOARD_DELIVERY_FAILED",\n        a,\n        String(payload.type ?? "unknown"),\n      );\n      this.safeClose(socket, 1011, "Dashboard transport delivery failed");\n      return false;\n    }\n  }\n  private safeClose(socket: WebSocket, code: number, reason: string): void {\n    try {\n      socket.close(code, reason);\n    } catch {\n      // The destination is already unusable; never propagate close failures.\n    }\n  }\n  private recordDiagnostic(\n    code: string,\n    a: SocketAttachment,\n    messageType: string,\n  ): void {\n    console.warn(\n      JSON.stringify({\n        component: "PlexonPanelRelay",\n        code,\n        serverId: a.serverId,\n        agentKind: a.kind ?? null,\n        messageType,\n        sessionAgeMillis: a.authenticatedAt\n          ? Math.max(0, Date.now() - a.authenticatedAt)\n          : null,\n        sequence: a.sequence ?? null,\n      }),\n    );\n  }''',
    "safe send helpers",
)

relay = replace(
    relay,
    "      if (currentAccess(m, a.access)) s.send(JSON.stringify(this.ready(m, a)));",
    "      if (currentAccess(m, a.access))\n        this.safeDashboardSend(s, this.ready(m, a), a);",
    "ready fanout",
)
relay = replace(
    relay,
    '        s.close(4003, "Device revoked or expired");',
    '        this.safeClose(s, 4003, "Device revoked or expired");',
    "safe revoked browser close",
)
relay = replace(
    relay,
    '        s.close(4003, "Host attachment revoked");',
    '        this.safeClose(s, 4003, "Host attachment revoked");',
    "safe revoked host close",
)

relay = relay.replace('version: "2.2.0"', 'version: "3.0.2"')

helper_anchor = "export function validDevice(value: unknown): value is Device {"
helper = r'''function messageTypeHint(message: ArrayBuffer | string): string {
  if (typeof message !== "string") return "binary";
  try {
    const parsed: unknown = JSON.parse(message);
    if (
      isRecord(parsed) &&
      typeof parsed.type === "string" &&
      parsed.type.length <= 64
    )
      return parsed.type;
  } catch {}
  return "unknown";
}

function protocolRejectionCode(
  error: unknown,
  authenticated: boolean,
): string | null {
  if (error instanceof SyntaxError) return "INVALID_ENVELOPE";
  const message = error instanceof Error ? error.message : String(error);
  if (/wrong room/i.test(message)) return "WRONG_SERVER";
  if (/protocol|agent kind/i.test(message)) return "PROTOCOL_MISMATCH";
  if (/invalid signature/i.test(message)) return "INVALID_SIGNATURE";
  if (/identity|room is already bound|host identity/i.test(message))
    return "INVALID_IDENTITY";
  if (/replay/i.test(message)) return "SESSION_REPLAY";
  if (/initial sequence/i.test(message)) return "INVALID_INITIAL_SEQUENCE";
  if (/challenge|candidate identity/i.test(message)) return "CHALLENGE_REJECTED";
  if (/authentication required/i.test(message)) return "AUTH_REQUIRED";
  if (/invalid access snapshot/i.test(message)) return "ACCESS_SYNC_INVALID";
  if (/host authorization changed/i.test(message))
    return "HOST_AUTHORIZATION_CHANGED";
  if (
    /event not allowed|presence|save lease|host backups disabled|only paper reports/i.test(
      message,
    )
  )
    return "INVALID_EVENT";
  if (/pairing|only paper issues|only paper approves/i.test(message))
    return "INVALID_EVENT";
  if (
    /envelope|timestamp|message id|missing|required|expected|invalid .*field|too large/i.test(
      message,
    )
  )
    return "INVALID_ENVELOPE";
  return authenticated ? null : "INVALID_ENVELOPE";
}

'''
if helper_anchor not in relay:
    raise SystemExit("missing helper anchor")
relay = relay.replace(helper_anchor, helper + helper_anchor, 1)
relay_path.write_text(relay)

# Version surfaces.
p = Path("package.json")
p.write_text(p.read_text().replace('"version": "3.0.1"', '"version": "3.0.2"', 1))
p = Path("lib/control-state.ts")
p.write_text(
    p.read_text().replace(
        "PlexonPanel Dashboard 3.0.1 / Protocol 3",
        "PlexonPanel Dashboard 3.0.2 / Protocol 3",
    )
)

# Relay regression coverage.
p = Path("relay/tests/room.test.mjs")
tests = p.read_text()
tests = replace(
    tests,
    "class Socket {\n  sent = [];\n  closed = null;",
    "class Socket {\n  sent = [];\n  closed = null;\n  failSend = false;",
    "fake socket failure flag",
)
tests = replace(
    tests,
    "  send(text) {\n    this.sent.push(JSON.parse(text));",
    "  send(text) {\n    if (this.failSend) throw new Error(\"simulated send failure\");\n    this.sent.push(JSON.parse(text));",
    "fake socket send failure",
)
tests = replace(
    tests,
    '''  assert.equal(host.socket.closed.code, 4008);\n  const m = await f.st.storage.get("room-metadata");''',
    '''  assert.equal(host.socket.closed, null);\n  assert.deepEqual(\n    (await f.st.storage.get("room-metadata")).devices.map((d) => d.deviceId),\n    [f.d.deviceId],\n  );\n  const m = await f.st.storage.get("room-metadata");''',
    "host divergence stays connected",
)

marker = 'test("client cannot exceed command, transfer, parameter or in-flight request limits", async () => {'
added = r'''test("broken Dashboard fan-out cannot disconnect an authenticated Paper agent", async () => {
  const f = await fixture();
  const paper = await attach(f);
  f.browser.failSend = true;
  await paper.send("telemetry.system", { hostCpuPercent: 1 });
  assert.equal(paper.socket.closed, null);
  assert.equal(paper.socket.attachment.authenticated, true);
  assert.equal(f.browser.closed.code, 1011);
});

test("broken Host peer delivery cannot retroactively reject healthy Paper", async () => {
  const f = await fixture();
  const host = await attach(f, "HOST");
  host.socket.failSend = true;
  const paper = await attach(f);
  assert.equal(paper.socket.closed, null);
  assert.equal(paper.socket.attachment.authenticated, true);
  assert.equal(host.socket.closed.code, 1011);
});

test("broken Paper peer delivery cannot retroactively reject healthy Host", async () => {
  const f = await fixture();
  const paper = await attach(f);
  paper.socket.failSend = true;
  const host = await attach(f, "HOST");
  await host.send("backup.coordination", {
    requestId: randomUUID(),
    leaseId: randomUUID(),
    operation: "prepare",
  });
  assert.equal(host.socket.closed, null);
  assert.equal(host.socket.attachment.authenticated, true);
  assert.equal(paper.socket.closed.code, 1011);
});

'''
if marker not in tests:
    raise SystemExit("missing regression test insertion anchor")
tests = tests.replace(marker, added + marker, 1)
p.write_text(tests)

# Protocol documentation and release notes.
p = Path("docs/PROTOCOL.md")
docs = p.read_text().replace(
    "Product/bundle version 3.0.1, wire version 3.",
    "Product/bundle version 3.0.2, wire version 3.",
    1,
)
note = '''\n## 3.0.2 post-authentication reliability\n\nAfter envelope, server, signature, session/replay, type and body validation succeeds, the agent packet is accepted. Dashboard fan-out, peer-agent delivery, Durable Object notifications and other post-authentication side effects are failure-isolated. A stale or broken destination may be discarded, but that failure cannot retroactively turn a valid sender packet into protocol corruption.\n\nHost `access.sync` remains removal-only. Safe stale or divergent Host snapshots are ignored and diagnosed without disconnecting the authenticated Host; malformed, replayed or tampered traffic still fails closed.\n'''
if "## 3.0.2 post-authentication reliability" not in docs:
    docs += note
p.write_text(docs)

p = Path("CHANGELOG.md")
changelog = p.read_text()
entry = '''## 3.0.2 — reliability candidate, live lifecycle acceptance pending\n\n- Isolate broken Dashboard and peer-agent WebSocket destinations from healthy authenticated senders.\n- Stop translating safe Host access reconciliation conflicts into transport rejection loops.\n- Keep malformed, replayed, wrong-server, invalid-signature and invalid-event packets fail-closed.\n- Add sanitized relay rejection diagnostics and regressions for broken Dashboard, Host and Paper destinations.\n- Preserve protocol v3 and existing immutable device scopes.\n\n'''
if not changelog.startswith("## 3.0.2"):
    changelog = entry + changelog
p.write_text(changelog)
