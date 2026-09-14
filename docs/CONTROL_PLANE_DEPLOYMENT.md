# PlexonPanel control-plane deployment

PlexonPanel Dashboard and its relay are one release unit even though Vercel and Cloudflare deploy them separately.

> A current Vercel production deployment does not imply the relay is current.

## Production identities

The Dashboard exposes `GET /api/build`. The Cloudflare Worker exposes `GET /healthz`. Both responses contain only non-secret deployment metadata:

```text
version
gitCommit
buildTimestamp
protocolVersion
runtimeKind
```

Settings -> Diagnostics also compares the Dashboard and relay commit. `Unverified` or `Mismatch` is not a green control-plane state.

## Canonical authorization contract

`protocol/action-scopes.json` is the source of truth for browser and relay action-to-scope metadata. Run:

```bash
npm run scopes:generate
npm run scopes:check
```

Do not edit `lib/scopes.ts` or `relay/src/scopes.ts` by hand. They are generated artifacts. In particular, Protocol 3 requires:

```text
backup.preflight -> backup.view
```

## Relay production configuration

The GitHub Actions repository variable `PRODUCTION_RELAY_URL` must be the exact public HTTPS relay origin used by the Vercel production environment's `NEXT_PUBLIC_PLEXON_RELAY_URL`.

The Actions secrets below must reference the existing Cloudflare deployment authority; do not create replacement credentials merely for this workflow:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

`.github/workflows/deploy-relay.yml` runs source checks, stamps the accepted `main` SHA into a generated Wrangler config, deploys the Worker, then fails unless production `/healthz` reports that exact SHA.

## Dashboard production deployment

Vercel remains responsible for the Dashboard production build. The Dashboard build response uses Vercel's git commit identity. After a `main` release, require:

```text
Dashboard /api/build gitCommit == accepted main SHA
Relay /healthz gitCommit       == accepted main SHA
Protocol                       == 3 on both
Relay runtimeKind              == cloudflare-worker (for Worker production)
```

If either identity is unavailable or different, treat the control plane as not fully deployed.

## Production smoke

The safe smoke sequence is:

1. Verify Dashboard `/api/build` and relay `/healthz` expose the same accepted SHA.
2. Open PlexonPanel Settings and confirm the control-plane build card is `Matched`.
3. Confirm Paper and Host are both connected.
4. Open Backups and click `Run backup diagnostics`.
5. Record the request ID.
6. Confirm no `SCOPE_DENIED` is shown.
7. Confirm the request reaches Host as `action=backup.preflight` with the same request ID.
8. Confirm the returned readiness data is Host-authoritative.
9. Refresh/reconnect the browser and repeat once.
10. After a controlled relay redeploy/reconnect, repeat once more.

The smoke must not create a backup, restore data, or restart the server.

## Diagnosing denied actions

Dashboard action failures preserve bounded diagnostic context where it is safely known:

```text
requestId
action
agentKind
code
rejectionBoundary
requiredScope
runtimeKind
```

Key boundaries for the current incident are:

```text
RELAY_SCOPE
RELAY_CAPABILITY
RELAY_ROUTING
PAPER_SCOPE
HOST_SCOPE
HOST_CAPABILITY
HOST_EXECUTION
```

A relay-side `SCOPE_DENIED` for `backup.preflight` should therefore display `RELAY_SCOPE` and `backup.view`. This metadata is diagnostic only; it does not alter or bypass authorization.

## Rollback

Rollback Dashboard and relay as a pair to the same accepted revision. Do not roll back only Vercel while leaving a newer Worker, or only the Worker while leaving a newer Dashboard. After rollback, verify both build endpoints report the same rollback SHA and repeat the read-only preflight smoke.

Never roll back by editing `devices.json`, granting extra scopes, disabling relay authorization, adding an Owner bypass, or re-pairing a valid device to conceal a deployment mismatch.
