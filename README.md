# PlexonPanel Dashboard

Private Next.js dashboard and Cloud Run gateway for PlexonPanel protocol v2.
The Paper plugin opens an outbound signed WebSocket to the gateway; a browser is
authorized with the plugin's one-use six-digit PIN and receives bounded live
state through the dashboard.

## Release capabilities

- one-use, five-minute server pairing PINs
- persistent server UUID plus Ed25519 identity binding
- `HttpOnly`, signed authorized-device browser sessions
- live TPS, MSPT, uptime, host resources, players, plugins, console, and chat
- locally governed console, player-message, player-kick, and global-chat actions
- Firestore-backed identity, device authorization, latest state, and audit data
- responsive desktop, tablet, and mobile UI with no fabricated preview fallback

The browser never receives a Firebase Admin credential and never reads
Firestore directly. `localStorage` contains only the harmless active-navigation
preference. Authentication remains in an `HttpOnly` cookie.

## Repository layout

- `app/` — Vercel dashboard and same-origin API handlers
- `gateway/` — Cloud Run HTTP/WebSocket gateway
- `firebase/` — deny-by-default browser rules and index configuration
- `docs/ARCHITECTURE.md` — protocol and trust boundaries
- `docs/VERCEL_DEPLOYMENT.md` — ordered release checklist

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- Firestore Native mode in the Firebase project
- Google Cloud Run and Secret Manager for the gateway

## Local validation

```bash
npm ci
npm run check
```

For dashboard development, copy `.env.example` to `.env.local`. Pairing and
live data require a running gateway; the interface deliberately shows an
unavailable state instead of pretending that demo data is live.

## Coordinated environment files

The generator accepts the Firebase files only as local inputs. It validates
that they belong to the same project, but never copies the service-account
email or private key into Vercel or Cloud Run output.

```bash
npm run env:vercel -- \
  --service-account "/secure/path/firebase-adminsdk.json" \
  --web-config "/secure/path/firebase-web-config.json" \
  --gateway-url "https://YOUR-GATEWAY.run.app" \
  --dashboard-origin "https://YOUR-DASHBOARD.vercel.app"
```

This creates ignored, mode-`0600` files:

- `.env.vercel` — import into the Vercel project
- `.env.gateway` — move values into Cloud Run/Secret Manager

The two files contain matching internal API and dashboard-token secrets. The
gateway file also contains the generated Ed25519 public key; copy only that
public value into the Paper plugin's `gateway.public-key` setting. Never commit
either output.

Firebase Web App identifiers are public by design and remain optional for
Analytics or future browser SDK use. They do not authorize Firestore access.
Cloud Run should use its runtime service account through Application Default
Credentials, not a service-account JSON stored in Vercel.

## Deployment

Follow [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md). Deploy the gateway
first, update the Vercel variables with its URL, deploy the review branch, then
configure the plugin with the gateway WebSocket URL and public key.

Never commit `.env*`, Firebase service-account JSON, gateway private keys,
pairing codes, or session secrets.
