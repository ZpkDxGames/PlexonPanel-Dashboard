# Release deployment checklist

Use the review branches first. Never add `.env.vercel`, `.env.gateway`, a
Firebase service-account JSON, or either Ed25519 private key to Git.

## 1. Finish Firebase and Google Cloud setup

1. Confirm Firestore is running in Native mode in `plexonpanel---database`.
2. Deploy `firebase/firestore.rules`; protocol v2 intentionally denies all
   direct browser access.
3. Enable a Firestore TTL policy for the collection-group field `deleteAt`.
4. Create a dedicated Cloud Run runtime service account.
5. Grant that runtime identity the minimum Firestore access needed by the
   gateway. Do not upload the service-account JSON to Vercel.
6. Enable Cloud Run, Cloud Build/Artifact Registry, Firestore, and Secret Manager
   APIs in the Google Cloud project.

## 2. Create coordinated release secrets

Generate the files locally. The gateway URL may be left blank for the first
Cloud Run deployment; rerun with `--force` after Cloud Run assigns the URL,
while preserving the already-deployed shared secrets and gateway identity.

```bash
npm run env:vercel -- \
  --service-account "/secure/path/firebase-adminsdk.json" \
  --web-config "/secure/path/firebase-web-config.json" \
  --dashboard-origin "https://YOUR-DASHBOARD.vercel.app"
```

The generator creates `.env.vercel` and `.env.gateway` with mode `0600`, does
not print secrets, and never copies the Firebase Admin private key. Before
regenerating, preserve these stable values in Secret Manager:

- `PAIRING_CODE_PEPPER`
- `PLEXON_GATEWAY_INTERNAL_KEY`
- `GATEWAY_DASHBOARD_TOKEN_SECRET`
- `GATEWAY_ED25519_PRIVATE_KEY`

The first three values shared with Vercel must remain identical. Gateway key
rotation requires updating every plugin's public-key setting.

When both generated files still exist, rerunning with `--force` preserves the
shared secrets, session secret, and gateway identity while updating URLs. If the
files were deleted, recover the stable gateway values from Secret Manager
instead of generating a second trust set.

## 3. Deploy the gateway to Cloud Run

1. Build from repository root with `gateway/cloudbuild.yaml` or
   `gateway/Dockerfile`.
2. Deploy the container on port `8080` with request timeout `3600` seconds.
3. Set minimum instances to `1` and maximum instances to `1` for release v2.
4. Attach the dedicated runtime service account.
5. Mount the four secrets above from Secret Manager.
6. Set `FIREBASE_ADMIN_PROJECT_ID` and an exact comma-separated
   `ALLOWED_DASHBOARD_ORIGINS` value.
7. Permit unauthenticated network invocation: agent/dashboard WebSocket routes
   perform application-layer authentication, while every internal HTTPS route
   requires the internal bearer key.
8. Confirm `GET /healthz` returns `protocolVersion: 2`.

Once Cloud Run supplies its HTTPS URL, rerun the environment generator with
`--gateway-url` but do not rotate the stored shared secrets. Copy the URL into
both Vercel gateway URL variables.

## 4. Configure Vercel

1. Keep `ZpkDxGames/PlexonPanel-Dashboard` private and connect it to the existing
   Vercel project.
2. Use the Next.js preset, repository root, detected build command, no custom
   output directory, and Node.js 22 or newer.
3. Import the completed `.env.vercel` into Preview and Production.
4. Mark the three server-only secrets as Sensitive where supported.
5. Remove any old `FIREBASE_ADMIN_CLIENT_EMAIL`,
   `FIREBASE_ADMIN_PRIVATE_KEY`, `PAIRING_CODE_PEPPER`, or
   `PLEXON_GATEWAY_AUDIENCE` variables from Vercel; protocol v2 does not use
   them there.
6. Redeploy after every environment-variable change.

Required Vercel runtime values:

```text
NEXT_PUBLIC_PLEXON_GATEWAY_URL
PLEXON_GATEWAY_HTTP_URL
PLEXON_GATEWAY_INTERNAL_KEY
GATEWAY_DASHBOARD_TOKEN_SECRET
SESSION_COOKIE_SECRET
```

The Firebase Web identifiers may remain; they are public and optional. They do
not authorize access to Firestore.

## 5. Review the dashboard branch

1. Push `agent/vercel-dashboard-refresh`.
2. Open its Vercel Preview deployment.
3. Check desktop, tablet, and mobile pairing screens.
4. Confirm `/api/system/status` returns HTTP 200 with `gatewayConfigured: true`
   and `sessionConfigured: true`.
5. Confirm an unauthenticated `/api/session` request returns 401 and no demo
   state appears.
6. Do not merge until the gateway origin allowlist contains the Preview origin
   used for the end-to-end pairing test.

## 6. Build and configure the Paper plugin

1. Build `agent/pairing-protocol-v2` with Java 25.
2. Copy `GATEWAY_ED25519_PUBLIC_KEY` from the protected gateway output into
   `plugins/PlexonPanel/config.yml` as `gateway.public-key`.
3. Set `gateway.url` to the Cloud Run WebSocket URL ending in `/v1/agent`.
4. Keep remote actions disabled initially; enable only required local
   capabilities and explicit console allow patterns.
5. Start the server and run `/plexonpanel diagnostics`; require
   `Gateway authenticated: true`.

## 7. End-to-end acceptance

1. Run `/plexonpanel pair` from the server console.
2. Verify the code appears only after gateway registration and expires after
   five minutes.
3. Enter it once in the dashboard; a second claim must fail.
4. Reload the page and restart the Paper server; the authorized device and
   server identity should restore automatically.
5. Verify live telemetry, players, plugins, bounded console, and chat.
6. Test only actions enabled in `config.yml`, then inspect the audit records.
7. Run `/plexonpanel unpair`; the open dashboard must lose authorization.
8. Merge the reviewed branches and let the Vercel `main` deployment become
   Production.

After successful import/deployment, securely remove the local generated env
files. They can be recreated only if the stable secrets are first recovered
from Secret Manager; accidental regeneration would break the deployed trust
relationship.
