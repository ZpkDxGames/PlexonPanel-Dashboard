# Cloudflare and Vercel deployment

Production remains gated on both repositories' acceptance record. These are operator instructions, not an automatic deployment.

## Relay

Preserve existing Worker/namespace, signing secrets, identity pins and migration history. The existing v1 SQLite-class migration remains; wire v3 does not require resetting it. Review relay/wrangler.jsonc and set exact DASHBOARD_ORIGINS for production and explicitly approved previews. No wildcard; observability stays off.

For a new relay only, `npm run relay:keygen` creates ignored owner-only secret files and a separate public key. Do not force-rotate an existing relay during an upgrade. Install the four bindings through the local secret file:

```sh
npx wrangler secret bulk relay/.relay-secrets.json --config relay/wrangler.jsonc
```

Bindings: PAIRING_CODE_PEPPER, ACCESS_TOKEN_SECRET, GATEWAY_ED25519_PRIVATE_KEY and GATEWAY_ED25519_PUBLIC_KEY. Only the public key is shareable. Never paste secrets into PRs/issues/chat/build logs.

Run check and relay:smoke first. Smoke uses temporary workerd storage and ephemeral keys, without deployment. After live acceptance/approval, `npm run relay:deploy`. Verify `/healthz` reports 2.2.0/protocol 3 and the pinned public key. Configure this key and WSS `/v1/agent` on both agents. Wrangler is pinned in package/lockfile.

## Dashboard

Use repository root, Next.js, Node 24, `npm ci`, `npm run build`. The only required Vercel variable is:

```dotenv
NEXT_PUBLIC_PLEXON_RELAY_URL=https://YOUR-RELAY.workers.dev
```

`npm run env:vercel -- --relay-url https://YOUR-RELAY.workers.dev` creates an ignored import file. Rebuild after URL changes because the client/CSP includes it. No Firebase or server-side Vercel credential is needed. Preview origins require explicit relay allowlisting; do not promote a preview before acceptance.

During a maintenance window upgrade relay with preserved keys first, matching dashboard next, then stopped-server Paper JAR and optional host. Verify the Paper UUID/fingerprint, re-pair an Observer, test denials/revocation, then grant only needed roles. Rollback is coordinated with saved configurations/baselines; never delete identities/namespaces to make old tokens work.
