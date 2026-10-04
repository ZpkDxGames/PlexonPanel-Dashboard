# Paired server workspace — 5.0.0

Opening the Dashboard shows the paired-server selector. The last selected server is highlighted; opening it resumes that server's last page. The workspace provides a named server switcher and an All servers entry. IndexedDB continues to store one credential and bounded cache per immutable server UUID. Display labels have separate keys and never select a relay room, account, path, service unit or command target. Existing explicit appearance preferences remain valid; new browsers default to light, compact, monochrome presentation.

The shell uses white/gray/black surfaces, pill controls, small shadows and restrained gradients. The selector uses a responsive card grid; shared-node details are collapsed initially. Connection labels remain readable without color. Existing keyboard navigation, native selects, dialog confirmation, reduced motion, high contrast and text scaling remain available. This change adds no runtime dependency: jsdom and fake-indexeddb are development-only test dependencies.

## Connection authority

| Visible state | Evidence |
| --- | --- |
| Connecting | Signed session/relay readiness has not completed. |
| Relay unavailable | Session or transport failed; Host and Minecraft states become unknown and commands are disabled. |
| Host disconnected | Authenticated relay reports no Host connection. A missing Paper connection does not prove that Minecraft stopped. |
| Minecraft stopped | Host is connected and compatible, Paper is absent, and a service sample no older than 30 seconds confirms an inactive service. |
| Minecraft connection unavailable | Paper is disconnected, but Host reports an active service or no fresh service evidence is available. |
| Starting / stopping / failed | Fresh Host service evidence reports the corresponding lifecycle state. |
| Telemetry stale | Agents are connected, but Minecraft telemetry is missing or older than 30 seconds. |
| Pairing required | The server's browser grant was revoked or expired. Other paired servers retain their grants. |

HTTP session requests and unauthenticated WebSocket readiness have a 10-second deadline. Retry backoff resets only after authenticated readiness. These deadlines do not change the HTTPS/WSS origin validation, signed grants, protocol 3, permission intersections, pairing or relay routing.

## Selection safety

A switch retires the command channel and confirmation synchronously, clears displayed state, grant, notices and editor state, then connects using the exact saved credential. Persistence runs independently of the connection transition. Selection revisions guard late HTTP responses, socket callbacks and old operation notices. Every actual switch increments the connection trigger, including A → B → A within one React event batch. The existing command generation checks still reject changed targets and ignore substituted or uncertain completions; commands are never automatically replayed.

Pages are stored under `plexonpanel-section:<serverId>`. Labels are stored under `label:<serverId>` separately from `credential:<serverId>` and `cache:<serverId>`. Forgetting one server deletes only its own label, credential and cache. The existing IndexedDB database and credential format remain compatible.

## Validation

Executed locally on 2026-10-04: `npm run check` passed all 79 relay tests and 153 Dashboard tests, contract checks, lint, TypeScript checks, and the production Next.js build. Both workerd and standalone relay smoke checks and standalone packaging passed. Production dependency audit reported zero vulnerabilities. Companion Core protocol/Host tests passed 247 cases using a fresh Java 25 compilation; the Core certification document records the limits of that direct run.

`npm run check` runs contract checks, lint, type checking, relay tests, a production Next.js build, rendered HTTP/security-header tests and Dashboard tests. `tests/dashboard-flow.test.mjs` mounts the actual Dashboard in jsdom and uses a real loopback standalone relay with signed simulated Paper/Host instances. It checks opening cards, remembered selection, per-server pages, cancellation during switching, a room-bound confirmed operation, same-tick switches, a delayed abandoned session grant, agent stop/disconnect/recovery, one-server revocation, and relay loss. Browser storage is simulated with fake-indexeddb. Only Next's lazy chunk loader and missing DOM platform APIs are adapted for this harness.

The real transport tests exercise HTTP, WebSocket challenge/signature authentication, room routing and completions. Minecraft, systemd, RCON, VPS filesystem policy and agent action payloads remain simulated. Loopback WS testing does not certify deployed TLS/WSS, proxy, CORS, CSP, or real process control.

Visual/mobile browser certification is outstanding. The local agent-browser helper could not start because this execution environment denies Unix socket creation. Chrome was obtained from the official Chrome for Testing endpoint using TLS verification, but no local browser page or screenshot succeeded. The cloud browser returned `ERR_BLOCKED_BY_CLIENT` for the loopback Dashboard. No visual, native keyboard, screen-reader or viewport-layout pass is claimed.

## Deployment without repeating the VPS migration

1. Review the Dashboard changes and companion Core regression test. Require the exact-source GitHub checks to pass. Core runtime code, relay server code, fleet/protocol manifests, systemd templates and schema 5 have no behavior change from this work.
2. Retain the working Minecraft/Host JARs, pairing identities, accounts, relay credentials, state, backups and both instance paths. Do not copy identities between instances, run schema migration again, alter service templates or touch TonimSMP UDP 24455 for this Dashboard-only update.
3. Follow `docs/COORDINATED_DEPLOYMENT_GATE.md` for the new accepted Dashboard source and exact CI run. The existing READY receipt names an earlier source and cannot authorize this source. Prepare the separate receipt-only activation commit after source acceptance; keep current operator decisions and recovery evidence accurate. Do not disable the gate or fabricate runtime evidence. Vercel's existing policy holds 5.0 previews.
4. Deploy through the existing Vercel project with the current relay origin and existing origin/CORS/CSP/WSS settings. No relay replacement or agent restart is required for these client changes. Confirm the exact Dashboard build identity and retain the previous Dashboard deployment for rollback.
5. Use the currently paired browser where possible. Verify both named cards, open each workspace, compare visible identity and telemetry with its own instance, switch repeatedly and reload. Verify server-specific console/history, players, backups and role controls with read-only operations first.
6. Complete real desktop/mobile browser checks at 360, 390, 768 and 1440 px, keyboard focus/select/dialog behavior, high contrast, 125% text, reduced motion and browser console/security errors. Confirm deployed WSS and reconnection through the actual proxy/relay.
7. Complete lifecycle, agent-disconnect, relay-outage, role/revocation, backup/restore and cross-account denial scenarios in an approved maintenance window or isolated staging instances. Source/DOM tests do not authorize disturbing either live server's current state. Record observed service states, exact build identities and scope before claiming full runtime certification.
8. Roll back the Dashboard by restoring the previous deployment if the client fails. This update has no credential-schema migration and requires no world-data rollback.

Full end-to-end runtime certification and stable-release evidence remain outstanding. This work makes the new client behavior reviewable and tested without changing the working VPS installation.
