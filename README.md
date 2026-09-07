# PlexonPanel Dashboard 2.2.0

PlexonPanel Dashboard is a responsive Next.js/Vercel control room with a Cloudflare Durable Object relay for signed protocol-3 Paper and Host agents. Dashboard 2.2 is the companion release for PlexonPanel agent 3.0.0: it adds live player-presence reconciliation, Paper-owned bounded history, and real roster refresh while retaining compatibility with older protocol-3 agents.

## Player presence in 2.2

- The Online roster applies immediate Paper `players.presence` deltas, de-duplicates event/session identity, and reconciles only after a complete multipart `inventory.players` snapshot.
- Socket/authenticated Paper session changes clear the roster. Cached browser state never presents a player as authoritatively online.
- Refresh invokes Paper-authorized `players.snapshot.request`, coalesced server-side and independently rate-limited to once per device per five seconds.
- The integrated History tab appears only when both the immutable grant and current Paper capability contain `players.history.view`.
- History queries are strict, newest-first, cursor-paginated, bounded to 100 entries per page, and served from the Paper-local journal. Results remain in memory and are excluded from IndexedDB.
- Missing scope, disabled local policy, older Paper agents, reconnecting, Paper offline, loading, empty, bounded, and query-failure states are distinct.
- Offline history details are read-only. Online actions retain their existing scope/capability checks.

Existing credentials do not gain the new scope. Observer remains current-roster-only; a local operator must explicitly revoke/re-pair a qualifying Moderator, Administrator, or Owner device after enabling history on Paper. Owner cannot bypass disabled history.

## Authority and storage

The relay verifies current scope/capability, rejects Host player events, validates presence/history fields, strips history-only fields from unauthorized recipients, and keeps action results private. It stores identity/access/pairing coordination only. Player inventories, presence bodies, history results, telemetry, file bodies, and action results are never written to Durable Object storage.

Browser credentials bind audience, protocol, server/device IDs, immutable role/scopes, generation, and expiry. Relay and executing agent independently authorize every action. The dashboard cannot enable local Paper policy, choose filesystem roots, or invent login/logout timestamps.

## Validate

Use Node 24 and the committed lockfile:

```sh
npm ci
npm run check
npm run relay:smoke
npm run build
```

`npm run check` runs ESLint, application and relay TypeScript, relay tests, client/state/UI tests, and a production Next build. Smoke uses temporary workerd storage and ephemeral keys; it is not deployed or live Paper acceptance.

## Development and deployment

Configure only the public relay origin in `.env.local`:

```text
NEXT_PUBLIC_PLEXON_RELAY_URL=https://plexonpanel-relay.plexonpanel.workers.dev
```

Never place access tokens, relay signing keys, Paper/Host private keys, pairing secrets, or server credentials in `NEXT_PUBLIC_*`. Deploy with the existing signing identity, Durable Object namespace, and identity pins intact. Dashboard 2.2 and agent 3.0.0 remain on wire protocol 3 and `/v1`; no identity rotation or database migration is required.

Read [release notes](RELEASE_NOTES_2.2.0.md), [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), [security](docs/SECURITY.md), [deployment](docs/VERCEL_DEPLOYMENT.md), and [validation](docs/VALIDATION.md).
