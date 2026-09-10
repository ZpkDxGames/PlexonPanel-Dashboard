# PlexonPanel Dashboard 3.2.0-rc.1

This is the dashboard/relay source candidate for the PlexonPanel Phase 2 control-plane release. The product remains on wire protocol 3; the version moves to 3.2.0 because the release adds compatible operational/reliability capability without a breaking wire contract.

## Product boundary

The dashboard is not an authority for Minecraft or host actions. It presents operator workflows and authenticated requests. Paper remains authoritative for Bukkit/Paper actions and Minecraft capability checks; the host companion remains authoritative for explicitly permitted VPS/service actions; the relay transports and routes protocol messages.

## Phase 2 delta

- Carries the reviewed standalone Protocol 3 relay implementation from the standalone-relay work branch.
- Keeps the Cloudflare Worker relay as a rollback path while the standalone relay is runtime-certified.
- Defaults the standalone relay to loopback and requires an explicit opt-in for public binding.
- Requires exact dashboard origins, strong pairing/token secrets, and a valid matching Ed25519 relay keypair.
- Preserves stable server identity and device grants through coordination-only SQLite state.
- Bounds dashboard and unauthenticated connection counts, handshake lifetime, pairing attempts, payload size, message sequencing, and reconnect/session behavior.
- Rejects protocol mismatch, wrong-room routing, stale/replayed session messages, unauthorized host identity and malformed privileged operations.
- Does not persist telemetry, console, chat or command payload history in the relay database.

## CI contract

`npm run phase2:verify` runs lint, TypeScript checks, dashboard tests, relay unit/contract tests, Worker relay smoke coverage, standalone relay smoke coverage, standalone packaging, and a production Next.js build. CI uploads the standalone relay deployment directory as a short-lived build artifact.

## Upgrade order

1. Preserve the current production dashboard/Worker relay and current Paper/Host binaries as rollback material.
2. Install the standalone relay candidate on loopback and validate its local health endpoint and service lifecycle.
3. Configure the Cloudflare Tunnel route without deleting the Worker rollback route.
4. Deploy this exact dashboard candidate with the candidate relay endpoint.
5. Upgrade the Paper plugin and host companion to the matching PlexonPanel 3.2.0-rc.1 candidate.
6. Run the complete end-to-end PlexonCraft acceptance matrix before any stable promotion or removal of the rollback path.

## Rollback

Dashboard source rollback: `main` at `03777c7dc108b54dda625c7f56f5e723ca35124f` plus the previously deployed Worker relay configuration. No paired Paper identity or device grant should be deleted as part of rollback.

## Certification

Source/CI candidate only until the coupled Paper, host, relay and dashboard runtime gates pass. Stable 3.2.0 is not authorized by this document.
