# PlexonPanel production gateway

The gateway is the private, persistent bridge between Paper agents and the
Vercel dashboard. Agents connect outbound to `/v1/agent`; authorized browser
devices connect read-only to `/v1/dashboard`. Pairing and dashboard mutations
use server-to-server HTTPS routes.

## Runtime requirements

- Node.js 22+
- Cloud Firestore in Native mode
- Application Default Credentials with Firestore access
- A stable Ed25519 gateway identity
- Cloud Run request timeout set to 60 minutes
- One Cloud Run instance for the first release

The one-instance limit is deliberate: live socket routing is held in memory.
Firestore preserves identities and bounded state, but it is not used as a
high-frequency socket backplane. Add Redis or Pub/Sub before increasing the
maximum instance count.

## Required environment variables

```text
PAIRING_CODE_PEPPER
PLEXON_GATEWAY_INTERNAL_KEY
GATEWAY_DASHBOARD_TOKEN_SECRET
GATEWAY_ED25519_PRIVATE_KEY
ALLOWED_DASHBOARD_ORIGINS
FIREBASE_ADMIN_PROJECT_ID
PORT=8080
```

Every secret must contain at least 32 characters. Keep the Ed25519 private key
and HMAC secrets in Secret Manager. `ALLOWED_DASHBOARD_ORIGINS` is a
comma-separated list of exact HTTPS origins; local HTTP origins are accepted
only for `localhost` and `127.0.0.1`.

Generate a persistent gateway identity once:

```bash
npm run gateway:keygen
```

Store `GATEWAY_ED25519_PRIVATE_KEY` as a secret. Put the returned public key in
the Paper plugin's `gateway.public-key` setting. Generating a new key without a
coordinated rotation will make every plugin reject the gateway.

## Build and test

```bash
npm run gateway:test
docker build -f gateway/Dockerfile -t plexonpanel-gateway .
```

`gateway/cloudbuild.yaml` builds the same image in Cloud Build. Deploy the image
to Cloud Run with port `8080`, a 60-minute request timeout, and maximum instances
set to `1`. The public service URL is required because Paper servers initiate
WebSocket connections from arbitrary hosts; all privileged HTTP routes still
require `PLEXON_GATEWAY_INTERNAL_KEY`.

## Firestore retention

Enable a collection-group TTL policy on the `deleteAt` field. Pairing challenge
records expire after their short audit window, and gateway audit records expire
after 90 days. TTL deletion is asynchronous, so every request also enforces the
challenge's explicit `expiresAt` value.
