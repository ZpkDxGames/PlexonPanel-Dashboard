# Database-less rc.2 deployment checklist

This is the ordered path for the review branches:

- dashboard: `agent/vercel-dashboard-refresh`
- plugin: `agent/pairing-protocol-v2`

Firebase billing, Firestore rules, TTL policies, Firebase Admin JSON, and
Firebase Web configuration are not used. Do not upload any of them to Vercel.

## 1. Prepare the dashboard checkout

From Windows Command Prompt in the existing dashboard repository:

```bat
git fetch origin
git switch agent/vercel-dashboard-refresh
git status --short
node --version
npm --version
npm ci
```

Use Node.js 22.13 or newer. `git status --short` should show only changes you
intend to keep. Do not clone the repository inside an existing checkout.

Validate before deployment:

```bat
npm run check
```

## 2. Create the relay identity once

Run from the dashboard repository root:

```bat
npm run relay:keygen
```

This creates three ignored files without printing credentials:

- `relay/.dev.vars` — local relay development bindings
- `relay/.relay-secrets.json` — Cloudflare secret-bulk input
- `relay/.relay-public.json` — public key to pin in the Paper plugin

Back up the two secret files in a secure password manager or encrypted storage.
Do not commit or send them in an issue. Do not run `--force` after deployment:
rotating this key requires updating every configured plugin.

## 3. Set the exact dashboard origins

Edit `relay/wrangler.jsonc`. Replace `DASHBOARD_ORIGINS` with the exact Vercel
origins allowed to pair and open dashboard sockets. Multiple origins are
comma-separated, with no paths:

```json
"DASHBOARD_ORIGINS": "https://YOUR-PROJECT.vercel.app,https://YOUR-BRANCH-ALIAS.vercel.app"
```

Do not use `*`. Use the stable Production domain and the exact Preview/branch
alias shown by Vercel for acceptance testing. Redeploy the relay whenever this
allowlist changes.

## 4. Deploy the free Cloudflare relay

Sign in and perform an initial deployment:

```bat
npx wrangler@latest login
npx wrangler@latest deploy --config relay/wrangler.jsonc
```

Immediately upload the generated bindings and deploy the final version:

```bat
npx wrangler@latest secret bulk relay/.relay-secrets.json --config relay/wrangler.jsonc
npx wrangler@latest deploy --config relay/wrangler.jsonc
```

If `secret bulk` offers to create or deploy the Worker, accept the operation.
Do not paste the secret values into `wrangler.jsonc`.

Cloudflare prints a URL similar to:

```text
https://plexonpanel-relay.YOUR-SUBDOMAIN.workers.dev
```

Open its health route:

```text
https://plexonpanel-relay.YOUR-SUBDOMAIN.workers.dev/healthz
```

Require `ok: true`, `protocolVersion: 2`, and
`storage: "coordination-only"`. The returned public key must match
`relay/.relay-public.json`.

## 5. Create and import the Vercel file

Generate the complete Vercel import file:

```bat
npm run env:vercel -- --relay-url "https://plexonpanel-relay.YOUR-SUBDOMAIN.workers.dev"
```

Import `.env.vercel` into both Preview and Production in Vercel. It contains
only:

```text
NEXT_PUBLIC_PLEXON_RELAY_URL
```

Delete obsolete Firebase and old gateway variables from the Vercel project,
including `FIREBASE_ADMIN_*`, `NEXT_PUBLIC_FIREBASE_*`,
`PLEXON_GATEWAY_*`, cookie secrets, and pairing peppers. rc.2 does not read
them. Redeploy after changing environment variables.

Vercel settings:

1. Repository: private `ZpkDxGames/PlexonPanel-Dashboard`.
2. Framework: Next.js.
3. Root directory: repository root.
4. Build command/output: detected defaults.
5. Node.js: 22 or newer.
6. Git branch for review: `agent/vercel-dashboard-refresh`.

Open the Preview URL and confirm the full-size pairing page renders. A missing
or blocked IndexedDB workspace must show a real error, never demo server data.

## 6. Build the Paper plugin branch

In the PlexonPanel plugin checkout:

```bat
git fetch origin
git switch agent/pairing-protocol-v2
git status --short
gradlew.bat clean test :agent:jar
```

The plugin requires Java 25. The output is:

```text
agent\build\libs\PlexonPanel-1.0.0-rc.2.jar
```

Copy the JAR into the disposable Paper 26.2 server's `plugins` folder and start
the server once to generate configuration.

## 7. Configure the plugin

Open `plugins/PlexonPanel/config.yml` and set:

```yaml
gateway:
  enabled: true
  url: "wss://plexonpanel-relay.YOUR-SUBDOMAIN.workers.dev/v1/agent"
  public-key: "PASTE_GATEWAY_ED25519_PUBLIC_KEY_FROM_relay/.relay-public.json"
  require-signed-messages: true
```

The public key is safe to copy; the private key is not. Keep all remote actions
disabled for the first connection. Restart Paper, then run:

```text
/plexonpanel diagnostics
/plexonpanel status
```

Require an authenticated relay connection before pairing.

## 8. End-to-end acceptance

1. Run `/plexonpanel pair` from the Paper console.
2. Confirm the code appears only after relay registration and expires after
   five minutes.
3. Enter it in the Vercel Preview dashboard.
4. Confirm a second claim of the same code fails.
5. Verify live TPS/system metrics, players, plugins, and enabled console/chat
   streams.
6. Reload the browser. The bounded IndexedDB workspace should restore and then
   refresh from Paper.
7. Restart Paper. The same server UUID/key should reconnect automatically.
8. Enable one safe action at a time in `config.yml`, test it, and inspect
   `plugins/PlexonPanel/audit/`.
9. Run `/plexonpanel unpair`. The open dashboard must disconnect and every old
   browser credential must fail on reconnect.
10. Check Cloudflare usage before merging the review branches.

## 9. Publish the reviewed branches

After every acceptance item passes, commit the intended files, push both
review branches, and update their pull requests. Merge the dashboard only after
the Cloudflare origin allowlist contains the final Production domain. Let
Vercel redeploy `main`, then repeat pairing once against Production.

Keep `relay/.dev.vars`, `relay/.relay-secrets.json`, `.env.vercel`, plugin
identity files, pairing codes, logs, and browser credentials out of Git.
