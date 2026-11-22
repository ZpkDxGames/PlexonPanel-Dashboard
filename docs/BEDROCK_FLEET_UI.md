# Bedrock fleet monitoring

The dashboard uses the existing browser pairing page and fleet selector for Paper and Bedrock. The relay administrator prepares Bedrock enrollment for the configured Bedrock Host. A browser claims the expiring code through `POST /v1/pairings/claim`. The relay validates the resulting credential on `GET /v1/dashboard/session` and on the authenticated `/v1/dashboard` WebSocket. This path uses Protocol 3 and the existing fleet and action contract IDs.

| Evidence | Paper | Bedrock |
| --- | --- | --- |
| Room authority | Paper agent and paired Linux Host | Explicit `HOST_ONLY` room with a pinned Bedrock Host |
| Game evidence | Paper TPS, JVM heap, roster and chat | Version only when observed for the current container boot. Gameplay readiness and players remain unavailable in this release. |
| Process status | Authenticated systemd service | Docker container state and uptime, with independent status and resource timestamps |
| Resource metrics | JVM and systemd service metrics | Docker CPU percentage per core and container RAM usage and limit |
| Console | Existing console authority, filters, command review and backfill | Bounded recent Docker log window as plain text |
| Operations | Existing reviewed Paper and Linux Host actions | Read-only monitoring |

## Adapter and UI boundaries

- `src/adapter/bedrock-room.ts` validates the additive `bedrock-host-v1` room, status and log window. A ready frame must contain explicit `BEDROCK`, `DOCKER` and `HOST_ONLY` metadata with a matching server ID, verified node ID and pinned `tonimbedrock` instance key. A previously authenticated Bedrock authority cannot change its node or fall back to Paper on the same room connection.
- `src/adapter/session.ts`, `src/adapter/fleet-feed.ts` and `src/adapter/control-state.ts` handle selected and passive room projections. Only a selected connection retains logs. Events require the matching current Host session and room identity, the advertised read capability and the matching device scope. Host replacement, relay loss or revocation clears read evidence. Historical core hash assertions remain active and pin the three updated adapter files.
- Bedrock status is distinct from the Paper server and service objects. `src/ui/bedrock/edition.ts` expires evidence after 30 seconds and marks missing, stale or invalid values unavailable. CPU percentage can exceed 100% across multiple cores. The node hardware ledger uses verified node samples and counts a shared node once.
- `src/ui/routes/Fleet.tsx` extends the existing cards and selector. `src/ui/bedrock/Workspace.tsx` provides the selected container and console views in the existing shell. Console logs are memory-only. Java-only actions and data stay in the existing Java workspaces.
- Lifecycle, console input, player administration, configuration, backup and restore require their own backend release gates. The dashboard refuses all generic actions for a Bedrock room. No separate API sends requests from browsers to the Docker broker.

## Verification

Use Node 24. From the dashboard root run:

```sh
npm ci
npm run typecheck
npm run lint
npm run verify:purge
npm test
npm run build
npx playwright install chromium
npm run verify:production
npm run verify:structure
npm run relay:test
npm run relay:standalone:smoke
npm run relay:standalone:package
node scripts/bedrock-qa.mjs
```

Set `CHROME_PATH` to use a local Chromium executable or `EVIDENCE_DIR` to choose where browser receipts and screenshots go. The mixed-edition browser test runs a real TCP relay locally. It generates one Bedrock pairing code and uses three fixture Paper rooms with signed credentials. Its telemetry and logs are fixtures, and the browser uses the same HTTP and WebSocket paths as deployed clients.

The local test sets `NEXT_PUBLIC_PLEXON_RELAY_URL` to the fixture's exact HTTP loopback origin. Only development builds allow this extra origin via CSP. The production CSP continues to allow the known HTTPS/WSS relay origins. A different isolated staging hostname requires an explicit staging CSP configuration.

The standalone relay suite restarts the loopback relay with a retained disposable SQLite sidecar. It verifies that the revoked browser credential fails both HTTP session validation and WebSocket upgrade, that reverting the registration file keeps the device revoked, and that removing the registration preserves three independently authenticated Paper/Host fixture rooms. The mixed versions include a 5.0 pair, a 6.0 pair and a mixed 6.0 Paper and 5.0 Host pair. ARM64/Box64 game acceptance is tracked by the core runbook. [ARM64 acceptance and rollout](https://github.com/ZpkDxGames/PlexonPanel/blob/development/bedrock-host-integration-v1/docs/BEDROCK_ARM64_RUNBOOK.md)
