# PlexonPanel control plane 3.2.0-rc.2 — dashboard/relay candidate

This repository supplies the dashboard and relay side of the coupled PlexonPanel Phase 2 product. The overall product candidate is 3.2.0-rc.2 while component-local versions remain intentionally compatible with their existing contracts: dashboard/Worker metadata 3.0.2, standalone relay 3.1.0, wire protocol 3.

## Product boundary

The dashboard is presentation and authenticated operator workflow, not execution authority. Paper owns Paper/Bukkit execution and Minecraft-side authorization; the host companion owns explicitly enabled VPS/service actions; the relay owns transport, routing and framing. Browser state cannot override a server-side or host-side denied capability.

## Phase 2 delta

- carries the reviewed standalone Protocol 3 relay implementation;
- retains the Cloudflare Worker relay as a rollback path during runtime certification;
- defaults standalone relay binding to loopback and requires explicit public-bind opt-in;
- requires exact dashboard origins, strong secrets and a valid matching Ed25519 relay keypair;
- preserves stable server identity and device grants through coordination-only SQLite state;
- bounds dashboard/unauthenticated connection counts, handshake lifetime, pairing attempts, payload sizes, queues and reconnect/session behavior;
- rejects protocol mismatch, wrong-room routing, stale/replayed session messages, unauthorized host identity and malformed privileged operations;
- does not persist telemetry, console, chat or command payload history in relay storage;
- upgrades Next.js and Cloudflare build/test tooling to versions that pass the repository's high/critical dependency audit gate.

## CI contract

`npm run phase2:verify` requires zero high/critical npm audit findings, then runs lint, TypeScript checks, relay unit/contract tests, dashboard tests, Worker relay smoke coverage, standalone relay smoke coverage, standalone packaging and a production Next.js build. CI uploads the standalone relay deployment directory as a short-lived artifact.

## Upgrade order

1. Preserve the current production dashboard/Worker relay and current Paper/Host binaries as rollback material.
2. Install the standalone relay candidate on loopback and validate local health/service lifecycle.
3. Configure the Cloudflare Tunnel route without deleting the Worker rollback route.
4. Deploy this exact dashboard source candidate with the candidate relay endpoint.
5. Upgrade Paper and host companion to the matching PlexonPanel 3.2.0-rc.2 Java candidate.
6. Run the complete end-to-end PlexonCraft acceptance matrix before stable promotion or rollback-path removal.

## Rollback

Dashboard source rollback is `main` at `03777c7dc108b54dda625c7f56f5e723ca35124f` plus the previously deployed Worker relay configuration. Do not delete paired Paper identity or device grants merely to roll back the dashboard/relay source.

## Certification

Source/CI candidate only until the coupled Paper, host, relay and dashboard runtime gates pass. Stable 3.2.0 is not authorized by this document.
