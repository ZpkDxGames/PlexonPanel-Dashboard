# PlexonPanel Standalone Relay Migration

> Status: **migration candidate / not production-cut over**. Protocol remains **3**. The Cloudflare Worker remains the rollback runtime until live acceptance is complete.

## Target topology

```text
Vercel Dashboard
    |
    | HTTPS / WSS
    v
Cloudflare edge + named Tunnel (no Worker execution)
    |
    v
cloudflared.service
    |
    v
127.0.0.1:8787 plexonpanel-relay.service
    |                     |
    | ws://127.0.0.1      | ws://127.0.0.1
    v                     v
Paper agent           Host companion
```

The standalone listener is loopback-first. Paper and Host use cleartext WebSocket only on loopback. Browser traffic remains HTTPS/WSS through Cloudflare Tunnel. Do not expose port `8787` publicly.

## Privacy and state model

The relay is still a coordination relay. SQLite stores only room/security coordination metadata needed to survive a process restart:

- Paper identity/capability metadata;
- pinned Host identity metadata;
- access generation/revision/device metadata;
- short-lived pairing registrations;
- bounded pairing-attempt rate-limit state.

The relay does **not** intentionally persist routine telemetry, console lines, chat, inventories, file bodies, backup payloads, action results, player coordinates or TPS/MSPT samples. WebSocket routing and pending action state remain process-local and bounded.

SQLite uses WAL, a busy timeout, transactional coordination updates, a schema-version guard and bounded expiry cleanup. A schema mismatch/corrupt room record fails closed rather than silently resetting authority.

## Runtime requirements

- Ubuntu 24.04 is the deployment target.
- Node must satisfy the repository engine (`>=22.13.0`).
- No standalone runtime npm dependency is required; SQLite is provided by `node:sqlite`.
- The relay must run as a non-root dedicated user.

## Developer workflow

```bash
npm ci
npm run relay:build
npm run relay:test
npm run relay:standalone:smoke
npm run relay:standalone:package
```

Worker compatibility remains available during migration:

```bash
npm run relay:worker:dev
npm run relay:worker:deploy
```

The legacy aliases `relay:dev` and `relay:deploy` still point to the Worker so rollback/operator muscle memory is not broken prematurely.

## Secret and relay-identity migration

Before changing any production endpoint, inspect the protected local checkout for the existing ignored relay files (for example `relay/.relay-secrets.json` and `relay/.relay-public.json`). Never print their private values into chat, shell history, CI or GitHub.

### Preferred path: preserve the relay identity

If the original relay Ed25519 private key and the HMAC secrets are securely available, place those values only in `/etc/plexonpanel-relay/relay.env`. Reusing the Ed25519 key keeps the existing Paper/Host relay public-key pin valid. Reusing `ACCESS_TOKEN_SECRET` permits existing browser credentials to remain cryptographically valid, subject to access generation/revision.

### Intentional rotation

If the original private key is unavailable:

1. generate a fresh relay Ed25519 keypair with the repository key-generation workflow;
2. store the private/public values only in the protected relay environment file;
3. update Paper `gateway.public-key`;
4. update Host `relayPublicKey`;
5. restart/reload clients in the documented order;
6. verify both authenticate;
7. if `ACCESS_TOKEN_SECRET` also changed, re-pair browsers.

Do not delete the Paper identity, Host identity or Paper device/access registry during this process.

## Build a deployment directory

```bash
npm ci
npm run relay:standalone:package
```

This creates `artifacts/plexonpanel-relay/` containing the compiled relay runtime plus the environment/systemd/Tunnel examples. Copy that directory to the VPS as `/opt/plexonpanel-relay/app` (or adjust the unit consistently).

The standalone runtime does not require a Next.js production install on the VPS.

## VPS filesystem and user

Example setup:

```bash
sudo useradd --system --home /var/lib/plexonpanel-relay --shell /usr/sbin/nologin plexonpanel-relay
sudo install -d -o root -g root -m 0755 /opt/plexonpanel-relay/app
sudo install -d -o root -g plexonpanel-relay -m 0750 /etc/plexonpanel-relay
sudo install -d -o plexonpanel-relay -g plexonpanel-relay -m 0700 /var/lib/plexonpanel-relay
```

Copy the packaged application as root. The service user should be able to read binaries/config but not modify them; it owns only the state directory.

Install the environment file:

```bash
sudo install -o root -g plexonpanel-relay -m 0640 relay.env /etc/plexonpanel-relay/relay.env
```

Use `relay/standalone/relay.env.example` as the field reference. Startup rejects missing keys, mismatched keypairs, short signing secrets, wildcard production origins, invalid ports and accidental public binding.

## systemd

Install `relay/standalone/plexonpanel-relay.service` as `/etc/systemd/system/plexonpanel-relay.service`, then validate the actual Node binary/application paths before enabling it.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plexonpanel-relay
sudo systemctl status plexonpanel-relay --no-pager
sudo journalctl -u plexonpanel-relay -n 100 --no-pager
```

Local health must pass before any client is moved:

```bash
curl -fsS http://127.0.0.1:8787/healthz
```

Expected safe fields include `service=plexonpanel-relay`, `runtime=standalone`, `protocolVersion=3`, `storage=coordination-only` and uptime/socket counts. Relay private/public keys, tokens, pairing codes and device registry contents are intentionally absent.

## Paper migration

Preserve the Paper server UUID, Paper Ed25519 identity and access registry. Change only the transport endpoint/pin as needed:

```yaml
gateway:
  enabled: true
  url: "ws://127.0.0.1:8787/v1/agent"
  public-key: "<PRESERVED_OR_ROTATED_RELAY_PUBLIC_KEY>"
```

Then restart/reload using the repository-supported procedure and run:

```text
/plexonpanel diagnostics
```

Require a connected/authenticated relay and a stable reconnect counter before proceeding.

## Host migration

Preserve `serverId`, Host private identity, data directory, access-registry location, local capability policy, backup configuration and service policy. Change the relay fields only:

```json
{
  "relayUrl": "ws://127.0.0.1:8787/v1/agent",
  "relayPublicKey": "<PRESERVED_OR_ROTATED_RELAY_PUBLIC_KEY>"
}
```

Then:

```bash
sudo systemctl restart plexonpanel-host
sudo systemctl status plexonpanel-host --no-pager
sudo journalctl -u plexonpanel-host --since "10 min ago" --no-pager
```

The Host must authenticate without a reconnect storm.

## Named Cloudflare Tunnel

Production must use a **named** Tunnel and a stable hostname such as `relay.<OWNER_DOMAIN>`. A temporary `trycloudflare.com` Quick Tunnel is not a production substitute.

Create/configure the tunnel using the installed/current `cloudflared` release and the account/zone that owns the stable domain. The repository example is:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: relay.<OWNER_DOMAIN>
    service: http://127.0.0.1:8787
  - service: http_status:404
```

Validate the config with the installed `cloudflared`, install/run it as its own systemd service and confirm:

```bash
systemctl status cloudflared --no-pager
journalctl -u cloudflared -n 100 --no-pager
```

Paper and Host must not depend on `cloudflared`; they remain connected to localhost if the Tunnel stops.

The relay trusts `CF-Connecting-IP` / `X-Forwarded-Proto` only when the direct peer is loopback and `PLEXON_RELAY_TRUSTED_PROXY=cloudflare-loopback`. This documents the trust boundary: the public ingress is local `cloudflared`, not an arbitrary raw listener.

## Public validation

From outside the VPS:

```bash
curl -i https://relay.<OWNER_DOMAIN>/healthz
```

Require `HTTP 200`. Separately confirm the raw `8787/tcp` listener is not reachable from the Internet (for example with `ss -ltnp` on the VPS and an external connection check).

## Vercel Dashboard

After public health succeeds, set production:

```text
NEXT_PUBLIC_PLEXON_RELAY_URL=https://relay.<OWNER_DOMAIN>
```

Redeploy Vercel. `next.config.ts` must retain exact `connect-src` entries for the HTTPS and WSS relay origins. Do not use `*` and do not allow every `*.vercel.app` automatically.

The browser should then derive:

```text
POST https://relay.<OWNER_DOMAIN>/v1/pairings/claim
GET  https://relay.<OWNER_DOMAIN>/v1/dashboard/session
WSS  wss://relay.<OWNER_DOMAIN>/v1/dashboard
```

## Recommended cutover order

1. install/start standalone relay;
2. pass local `/healthz`;
3. move Paper to loopback and verify authentication;
4. move Host to loopback and verify authentication;
5. observe stable local connections/reconnect counters;
6. install/start named `cloudflared` Tunnel;
7. pass public `/healthz`;
8. set Vercel relay env and redeploy;
9. pair an Observer browser;
10. run live browser/security/restart tests;
11. retain the Worker unchanged as rollback until owner sign-off.

If the relay identity rotates, install the new public-key pin in Paper/Host before expecting authentication.

## Live acceptance

Do not call the migration complete merely because `/healthz` is 200. Verify all of the following:

- Paper authenticated and idle reconnect count stable;
- Host authenticated and idle reconnect count stable;
- browser pairing succeeds;
- one logical browser socket survives navigation/history modal usage without leaks;
- refresh and tab close/reopen behave cleanly;
- invalid Origin/token/protocol/signature/identity/replay/action requests fail closed;
- local capability policy still overrides browser Owner role;
- Paper-only, Host-only, relay-only and cloudflared-only restarts recover independently;
- stopping cloudflared does not break Paper↔relay or Host↔relay;
- a prolonged relay outage yields bounded jittered attempts rather than a request storm;
- relay DB remains coordination-only.

## Rollback record

Before cutover record, without exposing private material:

- Worker URL;
- current Vercel relay environment value;
- Paper gateway URL and relay-key fingerprint;
- Host relay URL and relay-key fingerprint;
- current public relay-key fingerprint;
- Dashboard and PlexonPanel commit SHAs;
- current systemd service states.

## Roll back to the Worker

If the standalone candidate fails live acceptance:

1. leave identities/registries intact;
2. restore Paper/Host Worker WSS endpoint;
3. restore the prior relay public-key pin if it was rotated;
4. restore Vercel `NEXT_PUBLIC_PLEXON_RELAY_URL` to the Worker endpoint;
5. redeploy Vercel;
6. re-pair the browser only if the access-token signing secret changed;
7. verify Worker health and Paper/Host authentication.

Do not delete the Worker implementation/route during the candidate phase.

## Still-manual production inputs

This repository cannot invent these production values. They must be supplied/verified by the owner on the actual VPS/Cloudflare/Vercel accounts:

- stable Cloudflare-zone hostname (`relay.<OWNER_DOMAIN>`);
- named Tunnel UUID/credentials;
- whether the old relay Ed25519/HMAC secrets are securely available;
- actual `/etc/plexonpanel-relay/relay.env` secret values;
- the installed VPS Node/cloudflared paths and versions;
- Vercel production environment update/redeploy;
- live Paper/Host/browser acceptance and chaos tests.

Until those are complete, the code is a migration candidate and the Worker remains the production rollback path.
