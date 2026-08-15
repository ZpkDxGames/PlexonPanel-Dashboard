# PlexonPanel release architecture

## Service boundaries

1. **Paper plugin** owns a persistent server UUID and Ed25519 private key,
   collects bounded data, enforces local action policy, and connects outbound.
2. **Cloud Run gateway** authenticates agents, registers and claims pairing
   challenges, routes live WebSockets, authorizes dashboard devices, and writes
   bounded state to Firestore.
3. **Firestore** stores public server identity, authorized devices, short-lived
   pairing challenge hashes, latest snapshots, and bounded audit records.
4. **Next.js on Vercel** serves the dashboard, keeps authorization in an
   `HttpOnly` cookie, proxies mutations to the private gateway API, and issues
   five-minute read-only WebSocket grants.
5. **Browser** renders live state. It stores only the active navigation section
   in `localStorage`; it has no Firestore or Firebase Admin access.

The gateway is public only because arbitrary Paper hosts must initiate outbound
WebSockets. Its server-to-server HTTPS routes require a high-entropy internal
bearer key. Dashboard WebSockets require an exact allowed `Origin`, an
authorized device, and a short-lived HMAC token.

## Protocol v2 connection

All agent envelopes contain exactly these fields:

```text
protocolVersion, type, messageId, serverId, timestamp, body, signature
```

The body is Base64URL JSON. Ed25519 signs the canonical newline-separated
metadata and body. The gateway enforces message shape, UUIDs, body size,
30-second clock skew, replay IDs, and signature validity.

On each connection:

1. Agent sends signed `agent.hello` with public key, fingerprint, platform, and
   locally enabled capabilities.
2. Firestore binds the server UUID to that public key. A different key for the
   same UUID is rejected.
3. Gateway sends signed `gateway.challenge`.
4. Agent signs `challenge:<nonce>` and returns `agent.challenge_response`.
5. Gateway marks that exact connection online and sends
   `gateway.authenticated`.
6. Only then may telemetry, pairing, or privileged messages flow.

Cloud Run terminates long requests periodically, so the plugin reconnects with
bounded exponential backoff and repeats the challenge. The persistent UUID and
key restore the existing paired state automatically.

## Pairing state machine

1. An administrator runs `/plexonpanel pair` on the Paper server.
2. The plugin generates a cryptographically random six-digit code, request UUID,
   and five-minute expiry.
3. The authenticated plugin sends `agent.pairing_begin` over its signed socket.
4. The gateway writes a challenge document whose ID and verification value are
   independent HMACs. Plaintext PINs are never stored or logged.
5. Only after `pairing.registered` does the plugin display the code.
6. The browser posts the PIN to the same-origin Vercel handler. Per-address and
   per-code rate limits apply before a Firestore transaction claims it once.
7. The transaction creates an authorized-device record and marks the server
   paired. Vercel returns a signed `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
8. Gateway notifies the plugin with `pairing.complete`; the plugin persists only
   the paired boolean, never the PIN.

Running `/plexonpanel unpair` revokes all authorized devices and closes active
dashboard authorization. Rotating the plugin identity is a separate deliberate
operation and requires coordinated repair because the UUID/key binding rejects
silent identity replacement.

## Firestore shape

```text
servers/{serverId}
servers/{serverId}/authorizedDevices/{deviceId}
servers/{serverId}/state/latest
servers/{serverId}/auditEvents/{eventId}
pairingChallenges/{hmacLookupId}
```

The server document contains the public key, fingerprint, versions,
capabilities, paired state, connection state, and timestamps. The latest state
document has bounded `server`, `system`, `players`, `plugins`, and `errors`
slots. Chat is live-only and is not retained. Only warning/error console lines
are retained; connected dashboards may receive the fuller bounded live stream.

Set a Firestore TTL policy on `deleteAt`. Pairing challenge audit remnants use a
short retention; audit events use a 90-day retention. Expiry is always checked
synchronously because TTL deletion is asynchronous.

Browser Firestore rules deny every read and write. The Cloud Run runtime service
account accesses Firestore through Admin SDK Application Default Credentials.

## Action chain

```text
browser POST
  -> same-origin Vercel handler and device session
  -> internal-key gateway route and authorized-device check
  -> signed action.request
  -> plugin signature, replay, capability, and local-policy checks
  -> Paper main-thread execution where required
  -> signed action.result and audit record
```

Protocol v2 exposes only implemented actions. Console commands must pass the
plugin's allow/deny patterns. Player message and kick and global chat send must
be enabled in `config.yml`. Teleportation and plugin lifecycle changes are not
advertised or simulated.

## Scaling boundary

Release v2 runs the gateway with one Cloud Run instance because connected
socket routing and live-only chat are held in memory. Firestore preserves the
latest state across restarts but is not a high-frequency WebSocket backplane.
Introduce Redis or Pub/Sub routing and connection ownership before allowing
multiple gateway instances.

## Secret placement

| Value | Browser | Vercel | Cloud Run | Paper server |
|---|---:|---:|---:|---:|
| Firebase Web identifiers | optional/public | optional | no | no |
| Firebase service-account JSON | no | no | no; use runtime identity | no |
| Session cookie secret | no | yes | no | no |
| Internal API key | no | yes | yes | no |
| Dashboard token secret | no | yes | yes | no |
| Pairing HMAC pepper | no | no | yes | no |
| Gateway Ed25519 private key | no | no | yes | no |
| Gateway Ed25519 public key | no | no | derived | yes |
| Agent Ed25519 private key | no | no | no | yes |
