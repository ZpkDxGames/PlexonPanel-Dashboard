# PlexonPanel dashboard architecture

## Service boundaries

PlexonPanel separates browser-facing application work from persistent realtime transport:

1. **Next.js on Vercel** serves the private dashboard, exchanges Firebase ID tokens for secure sessions, authorizes HTTP handlers, and exposes bounded application APIs.
2. **Firebase Authentication and Firestore** store accounts, memberships, ownership, policies, pairing metadata, bounded current state, aggregate history, and audit records.
3. **PlexonPanel gateway on Cloud Run** maintains persistent plugin WebSockets, verifies device identity, signs privileged actions, applies transport limits, and fans out bounded realtime streams.
4. **Paper plugin** owns its Ed25519 private key, enforces the most restrictive local policy, and performs supported server actions.

Firebase is not the transport for unrestricted per-tick telemetry, raw console, or raw chat. The gateway carries realtime streams; Firestore stores current state, aggregates, ownership, policy, and required audit metadata.

## Canonical Firestore shape

```text
users/{uid}
organizations/{organizationId}
organizations/{organizationId}/members/{uid}
organizations/{organizationId}/pairingChallenges/{challengeId}
organizations/{organizationId}/auditEvents/{eventId}
servers/{serverId}
servers/{serverId}/latest/state
servers/{serverId}/players/{playerId}
servers/{serverId}/plugins/{pluginId}
servers/{serverId}/actions/{actionId}
servers/{serverId}/telemetryHourly/{bucketId}
```

`servers/{serverId}` is the only authoritative server record and contains its `organizationId` ownership reference. Do not create a second authoritative server document under an organization. Any future organization-scoped projection must be explicitly derived.

Recommended server fields include the public server identity, display name, ownership, Paper and plugin versions, online state, last-seen timestamp, and supported capabilities. The plugin's private Ed25519 key never leaves the Minecraft server.

## Data frequency and retention

- Keep one `latest/state` document for the current dashboard snapshot.
- Aggregate resource and TPS samples before writing history, normally every 15–60 seconds.
- Keep console and chat as bounded realtime streams with short retention.
- Do not create a Firestore document for every tick, console line, or chat event at unrestricted rates.
- Move high-resolution or long-term telemetry to a purpose-built store if it becomes a product requirement.
- Bound request bodies, messages, queues, log lines, reconnect state, and retained history.

## Protocol v1 pairing flow

1. The already-authenticated plugin requests a short-lived pairing challenge from the gateway.
2. The gateway generates a cryptographically random six-digit code.
3. The gateway hashes the code with a server-only pepper, stores only the hash, expiry, attempt count, challenge state, and candidate server identity, then sends the plaintext code only to the plugin in a signed response.
4. An authenticated organization owner enters the code in the dashboard.
5. The same-origin server handler verifies membership, rate limits, expiry, attempt count, claimed state, and the code hash using a constant-time comparison.
6. The gateway requires the plugin to prove possession of its Ed25519 private key before ownership is finalized.
7. A successful claim writes server ownership and an immutable audit event, then invalidates the challenge.
8. Unpairing or rotating the local identity revokes the old association and active authorization state.

Plain pairing codes must never be written to Firestore or application logs. Codes should expire in about five minutes, lock after repeated failures, and never be reusable.

## Authentication and authorization

- Use Firebase Authentication for dashboard users.
- Exchange a recently issued Firebase ID token for a short-lived `HttpOnly`, `Secure`, `SameSite=Lax` session cookie in a Node.js server handler.
- Protect the exchange and every state-changing handler against CSRF and cross-origin requests.
- Verify session revocation where required and clear sessions on logout.
- Enforce organization membership and per-server roles in server handlers, not only in the browser.
- Use custom claims only for coarse global roles; keep organization and server membership in Firestore.
- Require recent authentication and preferably MFA for owner-level destructive actions.
- Add Firebase App Check after observing legitimate traffic, then enforce it for client-accessible Firebase resources.

Browser reads remain constrained by Firestore Security Rules. Privileged writes, pairing, actions, roles, and audit creation go through trusted server or gateway code.

## Remote action chain

Every privileged action follows this sequence:

```text
authenticated user
  -> same-origin server handler
  -> membership, role, and recent-auth checks
  -> server policy and idempotency checks
  -> gateway-signed request
  -> plugin signature, replay, and local-policy checks
  -> Paper main-thread dispatch where required
  -> signed result and immutable audit event
```

The dashboard may enable only actions supported by both the current plugin protocol and local `config.yml`. Arbitrary console access, player teleportation, and plugin reload/disable controls are not part of the v0.1.0 production action set.

## Secret handling

Firebase Web App configuration is browser-visible by design, but must still be separated by environment. Authorization comes from Authentication, server checks, Security Rules, and App Check—not from hiding the Web API key.

Firebase Admin values, session secrets, gateway signing material, and the pairing-code pepper are server-only environment variables. Never expose them with a `NEXT_PUBLIC_` prefix, return them in API responses, copy them into React props, or place them in logs.

The initializer in `lib/server/firebase-admin.ts` reads only the minimum service-account fields from protected runtime variables and is imported only from Node.js server code. The original service-account JSON file is not part of this repository.

The `/api/system/status` handler reports only whether the required Firebase Admin fields are present and well formed. It returns no project identifier, email address, private-key material, or initialization error details.
