# PlexonPanel Dashboard

PlexonPanel is a database-less, real-time control surface for a Paper server.
The plugin opens an outbound signed WebSocket, a small Cloudflare Worker relays
live frames, and the Next.js dashboard renders them on Vercel. Vercel does not
receive a Firebase credential and neither hosted component stores telemetry,
console output, chat, or player history in an application database.

> **Release status:** `1.0.0-rc.2` is intended for review on a disposable Paper
> 26.2 server before production use.

## What ships in rc.2

- plugin-generated, one-use six-digit pairing codes with five-minute expiry
- persistent server UUID and Ed25519 identity binding
- exact dashboard-origin allowlisting and per-address pairing throttling
- scoped browser-device credentials that can be revoked with `/plexonpanel unpair`
- live TPS, MSPT, uptime, resources, players, plugins, bounded console, and chat
- locally governed console, player, whitelist, ban, and global-chat actions
- automatic reconnect plus fresh server, system, player, plugin, and console snapshots
- responsive desktop, tablet, and mobile layouts in the Plexon dark-navy,
  cyan, violet, green, and amber visual family

## Data ownership

| Location | Stored data |
| --- | --- |
| Paper server | persistent server UUID/private key, plugin settings, rotating local action audit |
| Cloudflare Durable Objects | public server identity, pairing generation, and short-lived pairing/rate metadata only |
| Vercel | application code and static/runtime assets only |
| Browser IndexedDB | one scoped device credential and a bounded workspace snapshot for this origin |
| Browser `localStorage` | active navigation section only |

Live telemetry is TLS-protected in transit and protocol messages between the
relay and plugin are signed. This is not end-to-end encryption: the relay must
process live frames in memory to route them. The application deliberately does
not persist those frames at the relay.

## Why Firebase is not required

The dashboard is a live viewer, so a central telemetry database adds cost,
retention responsibility, and another failure mode without being required for
the core experience. Users must never place Firebase Admin/service-account keys
in a browser or repository. Firebase Web configuration identifiers are not
secret, but they also do not replace authorization rules. A separate,
operator-owned archive exporter can be added later without changing the live
protocol.

## Repository layout

- `app/` — responsive Next.js dashboard
- `lib/` — relay client, IndexedDB workspace, and live-state transforms
- `relay/` — Cloudflare Worker and Durable Object relay
- `docs/ARCHITECTURE.md` — protocol, retention, and trust boundaries
- `docs/VERCEL_DEPLOYMENT.md` — ordered Windows-friendly release checklist

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- Cloudflare account with Workers and Durable Objects enabled
- Vercel project for this private repository
- the matching PlexonPanel rc.2 Paper plugin

## Local validation

```bash
npm ci
npm run check
```

For dashboard development, copy `.env.example` to `.env.local` and set the
public HTTPS relay origin. The UI shows a real unavailable/offline state when
the relay or Paper server is absent; it never substitutes fabricated live data.

## Vercel environment file

After the relay has a `workers.dev` URL, create the complete Vercel import:

```bash
npm run env:vercel -- \
  --relay-url "https://YOUR-RELAY.workers.dev"
```

The ignored `.env.vercel` contains one public value:

```text
NEXT_PUBLIC_PLEXON_RELAY_URL
```

No Firebase, service-account, session-cookie, or server-side Vercel secret is
used by rc.2.

## Deployment

Follow [the release checklist](docs/VERCEL_DEPLOYMENT.md). Deploy the relay,
import the one-variable Vercel file, redeploy the dashboard branch, configure
the plugin with the relay WebSocket URL and pinned public key, and then perform
the pairing acceptance test.

Never commit `.env*`, `.dev.vars`, `.relay-secrets.json`, an Ed25519 private
key, a pairing code, browser credentials, server logs, or Firebase
service-account JSON.
