# PlexonPanel rc.2 architecture

## Release decision

The default release has no Firebase, Firestore, SQL, or hosted telemetry
database. PlexonPanel is primarily a real-time viewer and controller. The Paper
server owns durable operational data, the browser owns its bounded convenience
cache, and the hosted relay retains only the minimum coordination state needed
to reconnect and revoke devices.

Giving every user a bring-your-own Firebase Admin key is not the default. A
service-account key is a server credential and must never enter browser code,
Vercel client variables, a plugin README example, or Git. An optional archive
adapter may be designed later as an explicit server-side export target.

## Service boundaries

1. **Paper plugin** owns a persistent random server UUID and Ed25519 private
   key, reads bounded state, enforces local action policy, writes the rotating
   local JSONL action audit, and connects outbound.
2. **Cloudflare Worker** is the HTTP/WebSocket entry point. It checks exact
   browser origins, verifies access tokens, hashes pairing lookups, and routes a
   server UUID to its Durable Object.
3. **ServerRoom Durable Object** authenticates the agent, signs relay control
   messages, joins authorized dashboards, and forwards live frames. Its storage
   contains only the public agent identity, paired flag, revocation generation,
   and current short-lived pairing registration.
4. **PairingDirectory Durable Object** contains HMAC-derived, short-lived
   pairing lookups plus HMAC-derived per-address rate state. Plain PINs and raw
   client addresses are not stored.
5. **Next.js on Vercel** serves the UI. rc.2 has no server-side API routes and
   no server secret; the browser connects directly to the relay.
6. **Browser** keeps a scoped 30-day device credential and bounded workspace in
   IndexedDB. `localStorage` contains only the selected navigation section.

## Protocol v2 agent connection

Agent envelopes contain:

```text
protocolVersion, type, messageId, serverId, timestamp, body, signature
```

The body is Base64URL JSON. Ed25519 signs canonical newline-separated metadata
and the encoded body. The relay checks envelope shape, maximum size, UUIDs,
clock skew, recent message IDs, public-key fingerprint, and signature.

Connection order:

1. The plugin connects to `/v1/agent?serverId=<uuid>` over `wss://`.
2. It sends signed `agent.hello` with its public key, fingerprint, versions,
   and locally enabled capabilities.
3. The room binds an unused server UUID to that public key. A later connection
   with another key is rejected.
4. The relay sends signed `gateway.challenge`.
5. The plugin signs `challenge:<nonce>` and sends
   `agent.challenge_response`.
6. The relay verifies the proof, replaces any older agent socket for that UUID,
   and sends signed `gateway.authenticated`.
7. Only the authenticated socket can register pairing codes or publish live
   events. Reconnect uses bounded exponential backoff and repeats the challenge.

The `gateway.*` protocol names and plugin configuration keys are retained for
wire compatibility; the production implementation is the Cloudflare relay.

## Pairing and revocation

1. An operator runs `/plexonpanel pair` on the Paper server.
2. The plugin generates a cryptographically random six-digit code, request UUID,
   and five-minute expiry. It does not persist the PIN.
3. The authenticated plugin sends signed `agent.pairing_begin`.
4. The room stores a short-lived registration and the directory stores only an
   HMAC lookup. The plugin displays the PIN after `pairing.registered`.
5. The browser sends the PIN from an allowlisted origin. The directory applies
   a ten-attempt/fifteen-minute per-address rate window before lookup.
6. The room atomically consumes its current challenge, marks the server paired,
   and issues a signed, server/device/generation-scoped browser token.
7. The credential is stored in that browser origin's IndexedDB and is presented
   in the WebSocket subprotocol. It is never transmitted to a Vercel server.
8. `/plexonpanel unpair` increments the room generation, closes active
   dashboards, and makes every earlier browser token invalid.

The browser validates its token and current generation before each reconnect.
Expired or revoked credentials are deleted locally and return the UI to pairing.

## Live state and retention

The relay forwards these authenticated agent events without calling Durable
Object storage:

```text
telemetry.server
telemetry.system
inventory.players
inventory.plugins
console.lines
chat.message
action.result
```

When a dashboard joins, the relay requests a new snapshot. The plugin sends
server/system/player/plugin state and up to 100 recent redacted console lines
from the current in-memory ring, in batches of 25. Chat is live-only.

The browser bounds its workspace to 30 TPS points, 200 console rows, 200 chat
messages, 20 action results, and the current player/plugin/resource snapshots.
Clearing site data or using another browser/device removes that local history
and requires pairing again. IndexedDB is a convenience cache, not an audit or
backup. Paper's rotating local JSONL audit remains the authoritative action
record.

Cloudflare necessarily processes live plaintext after TLS termination so it
can route frames. Therefore rc.2 promises TLS in transit, signed protocol
messages, minimal coordination persistence, and no application telemetry
retention—not end-to-end encryption.

## Remote action chain

```text
authorized browser WebSocket
  -> relay token generation check
  -> relay-signed action.request
  -> plugin signature, replay, capability, and local-policy checks
  -> Paper main-thread execution where required
  -> idempotent signed action.result
  -> Paper-local audit and live browser result
```

The plugin keeps a bounded completed-request cache so reconnect/retry does not
repeat a successful or denied action. Console commands must pass explicit local
allow and deny patterns. Player, whitelist, ban, chat, and console features are
independently opt-in. Plugin lifecycle and arbitrary file operations are not
part of protocol v2.

## Secret and data placement

| Value | Browser | Vercel | Cloudflare | Paper |
| --- | ---: | ---: | ---: | ---: |
| Public relay URL | yes | public env | yes | yes |
| Browser device token | IndexedDB | no | verifies | no |
| Pairing pepper/access-token secret | no | no | encrypted secret binding | no |
| Relay Ed25519 private key | no | no | encrypted secret binding | no |
| Relay Ed25519 public key | received/visible | no | returns/signing identity | pinned config |
| Agent Ed25519 private key | no | no | no | protected plugin file |
| Live telemetry/log/chat | bounded memory/cache | no | memory only | source/current ring |
| Action audit | bounded display | no | memory only | rotating JSONL |

## Free-tier and scaling boundary

Each server UUID maps to one Durable Object, allowing active servers to be
isolated without a central state table. Hibernation-compatible WebSockets allow
an idle object to sleep while clients remain connected. The default telemetry
cadence is five seconds for server state and ten seconds for system metrics to
keep traffic modest.

The project can run within Cloudflare's published Workers/Durable Objects Free
allowances at small community scale, but plan limits and pricing are external
and can change. Monitor Cloudflare usage before public growth. If traffic
outgrows the free plan, first reduce sampling and message volume; do not add a
telemetry database merely to solve relay throughput.
