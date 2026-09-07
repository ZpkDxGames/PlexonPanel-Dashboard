# Cloudflare relay deployment

## Relay

Preserve existing Worker/namespace, signing secrets, identity pins and migration history. The existing v1 SQLite-class migration remains; wire v3 does not require resetting it. Review relay/wrangler.jsonc and set exact DASHBOARD_ORIGINS for production and explicitly approved previews. No wildcard; observability stays off.

For a new relay only, `npm run relay:keygen` creates ignored owner-only secret files and a separate public key. Do not force-rotate an existing relay during an upgrade. Install the four bindings through the local secret file:

```sh
npx wrangler secret bulk relay/.relay-secrets.json --config relay/wrangler.jsonc
```

Bindings: PAIRING_CODE_PEPPER, ACCESS_TOKEN_SECRET, GATEWAY_ED25519_PRIVATE_KEY and GATEWAY_ED25519_PUBLIC_KEY. Only the public key is shareable. Never paste secrets into PRs/issues/chat/build logs.

Run check and relay:smoke first. Smoke uses temporary workerd storage and ephemeral keys, without deployment. After live acceptance/approval, `npm run relay:deploy`. Verify `/healthz` reports 2.2.0/protocol 3 and the pinned public key. Configure this key and WSS `/v1/agent` on both agents. Wrangler is pinned in package/lockfile.


Use the coordinated upgrade/rollback steps in [DEPLOYMENT](DEPLOYMENT.md).
