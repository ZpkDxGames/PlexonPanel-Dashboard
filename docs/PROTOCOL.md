# Protocol 3 contract

Dashboard/relay version 2.2.0 is compatible with PlexonPanel agent bundle 3.0.0; wire version remains 3. Routes retain `/v1`; protocol 2 is explicitly incompatible. Paper and host initiate WSS `/v1/agent?serverId=<uuid>&agentKind=PAPER|HOST` with `X-PlexonPanel-Protocol: 3`.

## Envelope

Every agent-direction message is Ed25519 signed, with exactly seven JSON fields:

| Field           | Encoding                                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| protocolVersion | Number 3                                                                         |
| type            | `[a-z][a-z0-9_.-]{0,95}`                                                         |
| messageId       | UUID v1–5, RFC variant                                                           |
| serverId        | Existing Paper UUID                                                              |
| timestamp       | UTC ISO-8601, within 30 seconds of receiver clock                                |
| body            | Unpadded Base64URL of one strict UTF-8 JSON object, at most 65,536 decoded bytes |
| signature       | Ed25519 64 bytes, 86 unpadded Base64URL characters                               |

Envelope maximum is 131,072 UTF-8 bytes. Sign this exact UTF-8 concatenation with LF separators and **no trailing LF**:

```text
3\n<type>\n<messageId>\n<serverId>\n<timestamp>\n<body>
```

Keys use Base64 DER: X.509/SPKI public, PKCS#8 private locally. Validate fields, server binding, timestamp, signature and replay before trust. Java and TypeScript verify the identical public-only [wire fixture](../relay/fixtures/v3-envelope.json).

Every agent→relay body contains signed `_session` (fresh random UUID per WebSocket) and `_sequence` (positive safe integer, hello is 1, strictly increases). The relay rejects a different session or repeated/old sequence; reconnection changes the session and discards queued old frames. Relay→agent uses the bounded envelope UUID/freshness replay guard, which fails closed at capacity.

## Authentication and grants

1. `agent.hello` identifies kind, versions, key/fingerprint, local capabilities and Paper's independently pinned host key.
2. Relay sends signed `gateway.challenge`; agent responds with `agent.challenge_response`, proving its key by signing UTF-8 `challenge:<nonce>`. Challenge expires after 15 seconds.
3. `gateway.authenticated` follows verification. Paper establishes/reuses the room identity pin. Host must match Paper's host pin and cannot establish one itself.
4. Local pairing creates a one-use five-minute role/scope grant. `agent.pairing_begin` registers a peppered code lookup. HTTP POST `/v1/pairings/claim` accepts code and label only; client role/scopes are rejected.
5. Relay sends `pairing.consume`; Paper persists locally before `pairing.accepted` returns requestId, generation, revision and device. Concurrent claims and revocation races fail closed.
6. The HMAC bearer credential binds audience `plexonpanel-relay`, protocol, server/device IDs, immutable role/scopes, generation and issue/expiry times (maximum 30 days).
7. Browser preflights `/v1/dashboard/session` with Authorization, then uses WebSocket subprotocols `plexonpanel-v3` and `auth.<credential>`. Tokens never enter URLs; origin must be allowlisted.

`access.sync` carries authoritative local generation/revision/devices. Stale state cannot undo revocation; a host can remove existing grants, never invent one. Revoke-all increments generation, active revoked browsers close and agents independently check their local registry. Last-seen means successful authorized activity, throttled to one minute, not idle presence.

## Actions and events

Browser sends `{type:"dashboard.action",requestId,action,parameters,agentKind?}`. Relay checks current grant/scope, local capability, Owner/confirmation constraints, size and rates. Signed `action.request` carries authenticated context; the agent repeats local authorization, validates typed arguments, durably audits intent and executes on bounded workers.

`dashboard.action_queued` acknowledges routing only. Private `server.event` with eventType `action.result` returns final data/status only to the requesting device. Status includes SUCCESS, CONFLICT, DENIED, FAILED or NOT_AVAILABLE. Disconnect/timeout requires local outcome verification and is never automatically replayed. A completed operation whose result audit fails explicitly requests verification before retrying.

Parameters: at most 16 keys / 49,152 bytes. Per-device limits: 20 actions or 160 chunks per 10 seconds, 32 pending requests; room limit 64 pending. Agents have independent bounded gates. Intent UUIDs survive process restart through the local audit replay window. Commands/messages/file bodies are excluded from audit parameters.

Inventory batches use `snapshotId`, `capturedAt`, `offset`, `complete`, and `truncated`, targeting ≤48 KiB. Clients stage player pages until complete, discard mismatched/out-of-order pages, replay only deltas newer than the snapshot capture instant, and clear the roster at a socket or authenticated Paper-session boundary. Recipient filters independently remove player location/address, history-only fields, full-console levels, and disabled events. Host cannot spoof Paper telemetry or player presence.

### Agent 3.0 player additions

| Name | Direction | Contract |
| --- | --- | --- |
| `players.presence` | Paper event | Strict minimal `JOINED`/`LEFT` delta under `players.view`; Host is rejected. Event/session IDs are de-duplicated in a bounded client set. |
| `players.history.list` | Dashboard action | Paper-only; requires both `players.history.view` and the current Paper capability. Query, status, UTC range, opaque cursor, and limit (1–100) are strict. |
| `players.snapshot.request` | Dashboard action | Paper-only under `players.view`; no parameters; independently limited to once per device per five seconds. |

Presence timestamps are UTC ISO-8601 instants. Null logout/duration means unknown and must not be replaced with a browser observation. Optional `inventory.players` fields include `sessionId`/`sessionStartedAt`; `firstSeenAt` and `lastLoginAt` are forwarded only to a recipient with authorized, locally enabled history.

History responses contain `entries`, nullable `nextCursor`, `hasMore`, `boundedWindow`, `capturedAt`, and `historyEnabled`. They are delivered through the existing private `action.result` route to the requesting device only. The Durable Object persists neither responses nor presence/player-inventory bodies. Older protocol-3 agents omit these optional events/capabilities without breaking the Online view.

Transfers use start → ordered 16 KiB chunks → cancellation/expiry, with final SHA-256 verification. File bodies and action results are transient. Durable Object storage contains identity/access/pairing coordination only; bounded socket attachments retain pending routing metadata across hibernation. Cloudflare's attachment limit is [16,384 bytes](https://developers.cloudflare.com/durable-objects/best-practices/websockets/); signed session sequences avoid unbounded replay arrays.

## 3.0.2 post-authentication reliability

After envelope, server, signature, session/replay, type and body validation succeeds, the agent packet is accepted. Dashboard fan-out, peer-agent delivery, Durable Object notifications and other post-authentication side effects are failure-isolated. A stale or broken destination may be discarded, but that failure cannot retroactively turn a valid sender packet into protocol corruption.

Host `access.sync` remains removal-only. Safe stale or divergent Host snapshots are ignored and diagnosed without disconnecting the authenticated Host; malformed, replayed or tampered traffic still fails closed.
