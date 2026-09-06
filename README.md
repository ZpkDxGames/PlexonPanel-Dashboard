# PlexonPanel Dashboard 2.1.0

PlexonPanel Dashboard is a responsive Next.js/Vercel control room for protocol 3 PlexonPanel Paper and Host agents. Version 2.1 focuses on the operator experience: a more compact control-room shell, clearer connection and freshness states, stronger browser-local telemetry tooling, safer lifecycle controls, and more consistent management surfaces.

The dashboard keeps the existing twelve workspaces: Overview, Performance, Players, Console, Chat, Plugins, Files, Backups, Server, Audit, Access, and Settings. Existing scoped actions, file conflict/diff handling, backup safeguards, isolated server workspaces, local audit sources, and explicit offline/expired/revoked states remain part of the protocol-3 design.

## Dashboard 2.1 highlights

- Compact graphite/navy control-room shell with cyan Plexon accent, grouped navigation, responsive mobile drawer, and consistent focus states.
- Global server identity, Paper/Host connection indicators, freshness status, quick actions, and `Ctrl/Cmd + K` command palette.
- Overview health summary derived only from telemetry currently available to the browser. Missing telemetry is shown as unavailable rather than fabricated.
- Performance workspace with 1/5/15/30-minute browser-local windows, pause/resume, chart hover/crosshair, axes, current/min/avg/max/P95 summaries, CSV/JSON export, and local-history reset.
- Browser-local rolling history remains bounded and is never presented as server-side historical storage.
- Server lifecycle controls are gated by actual `active`, `inactive`, `activating`, `deactivating`, and `failed` service state so impossible actions such as Start-while-active are disabled.
- Action failures map known protocol/agent codes to operator-facing guidance without exposing raw exception internals or secrets.
- Existing management pages inherit the 2.1 surface/control styling while retaining their protocol-3 behavior and authorization checks.

## Pairing and authority

Pair a browser locally with `/plexonpanel pair <role>`. Pairing codes are one-use and expire after five minutes. The local operator chooses the role; the browser cannot escalate itself. The relay and the selected Paper/Host agent independently validate scopes and local capabilities, and Owner operations still cannot bypass local policy.

The authorization path remains:

```text
Browser credential
      ↓
Cloudflare relay scope validation
      ↓
Paper / Host agent validation
      ↓
Local capability policy
      ↓
Operation
```

## Validation

Use Node 24 and the committed lockfile:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run relay:test
npm run relay:smoke
npm run build
```

The aggregate validation command remains:

```sh
npm run check
```

## Development and deployment

For development, set `.env.local` with:

```text
NEXT_PUBLIC_PLEXON_RELAY_URL=https://plexonpanel-relay.plexonpanel.workers.dev
```

Then run `npm run dev`. The public HTTPS relay origin is the only required Vercel variable. Never place access tokens, relay signing keys, Paper/Host private keys, pairing secrets, or server credentials in `NEXT_PUBLIC_*` variables.

The production dashboard origin is `https://plexon-panel-dashboard.vercel.app`. Do not hardcode preview deployment URLs into application logic.

Read [deployment](docs/VERCEL_DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), [protocol](docs/PROTOCOL.md), [operations](docs/OPERATIONS.md), and [validation](docs/VALIDATION.md).

## Compatibility and storage

Dashboard 2.1 remains on **protocol 3**. A UI release does not rotate the relay signing identity, replace the Cloudflare Worker, reset Durable Objects, or require a new telemetry database. Existing paired protocol-3 credentials remain compatible unless a separate security migration explicitly says otherwise.

No Firebase, telemetry database, Vercel server credential, inbound Minecraft administration port, shell, or RCON is required. Cloudflare stores identity/access/pairing coordination only. Telemetry history is bounded browser-local state; authoritative audit and backups remain on the agents/host, with optional configured off-site copies.

See [RELEASE_NOTES_2.1.0.md](RELEASE_NOTES_2.1.0.md) for the release summary.
