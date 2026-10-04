# Selected-server workspace and lifecycle feedback

## Result

This Dashboard-only source update fixes false lifecycle errors, exposes supported configuration editing and refreshes every selected-server page through one shared presentation system. It requires no new Host/Paper JAR, scope, action contract, relay deployment, migration or pairing. Keep the running VPS installations and their current states intact.

The selected workspace has a quieter navigation rail, a persistent server switcher, concise page descriptions, explicit relay/Host/Minecraft connection states, compact controls and a cleaner server-control page. Runtime details are expandable. Configuration is a first-class page. Client settings open from both the paired-server selector and the workspace header, with the same persisted theme, accent, contrast, density, text size, motion, chart style/grid/layout/window, timezone, player-display and display-cadence preferences.

The new Configuration page prefers Paper for editable files instead of always preferring the read-only Host. Owner already has all canonical scopes; local capabilities must still be enabled. The page exposes the effective permission boundary and preserves the existing file review, hash-conflict handling, transfer limits and unsaved-edit protection. Protected `server.properties`, agent policy, identity and credential paths remain local operator responsibilities. See the Core repository's `docs/OWNER_CONFIGURATION_5.0.md` for exact per-instance paths and optional local enablement.

## Lifecycle correction

The prior Dashboard used one connection generation containing both agents' sessions and presence. A normal Paper disconnect/reconnect during a successful Host lifecycle command therefore rejected that pending command as a connection change.

The current binding separates browser authorization from Paper and Host authority generations. A Host completion survives unrelated Paper transitions. Changing its Host session, capabilities, compatibility, server identity, browser socket or signed grant still invalidates it. Paper requests retain equivalent protections. Completion must match the original socket, server, action and source agent. Queue acknowledgement never means success; uncertain commands are never automatically resent. Chunked downloads and their cancellation retain the captured target for the entire transfer.

## Cleanup and production structure

`app/page.tsx` now mounts the canonical `app/dashboard.tsx`; the unused older Dashboard implementation is removed. Unused management/backup aliases, legacy workspace transformations/types/cache adapters and dead view declarations are removed. Remaining communication components are named for their active purpose.

One `app/dashboard.css` replaces 19 imported global stylesheets. Unreachable rules were removed and repeated declarations for identical selectors under identical conditional ancestry were consolidated without reordering other selectors. Active responsive/container layouts, dialog/console/player/backup feature styles and preference hooks remain. No blur backdrop is loaded. There is no additional legacy shell or override stylesheet to accidentally load in production. The standalone Activity page retains its scoped CSS module.

## Validation

Local validation on 2026-10-04:

- `npm run check`: contract checks, lint, TypeScript, production Next build, HTTP/security-header rendering checks, 79 relay tests and 157 Dashboard tests passed.
- The mounted Dashboard uses an actual loopback standalone relay and signed simulated Paper/Host instances. It verifies server selection/switching, abandoned grants, revocation, separate connection states, successful start/stop/restart across Paper session transitions, preference changes and persistence, Paper-bound configuration saves, review-before-write, conflict preservation and unsaved-edit switch protection.
- Fixtures now emit the agent's canonical `SUCCESS`/`CONFLICT` result statuses; lifecycle coverage asserts the completed operation timeline in addition to notification text.
- Client requests still use the same authentication, scope enforcement, WSS contract and browser credential schema. No Core runtime or relay runtime source is changed.

The fixture agents simulate Minecraft and filesystem operations; they do not execute systemd, real config writes or VPS lifecycle changes. Native visual/mobile/keyboard verification is still outstanding: agent-browser could not start its daemon in this execution environment, and its Chrome installer reported a certificate-chain error. No native browser pass or deployed WSS/runtime certification is claimed. Exact-source GitHub CI is recorded on the source PR separately.

## Deployment steps

1. Review the source PR and require passing exact-source CI before merging. No VPS JAR replacement or agent restart is needed for the Dashboard changes.
2. Accept the new merged Dashboard source SHA and its passing CI run in a separate receipt-only activation commit, following `COORDINATED_DEPLOYMENT_GATE.md`. The accepted source must be that activation's immediate parent. Do not reuse the current receipt's earlier source acceptance or mark runtime certification executed based on fixture tests.
3. Deploy through the existing Vercel production project and current standalone relay origin. Preserve production CORS/CSP/WSS configuration. Keep retired Worker automatic builds disconnected; this source change does not authorize Worker publication. Retain the prior Dashboard deployment for rollback.
4. In the existing paired browser, verify the new `/api/build` identity, both named selector cards, each server's own data, switching/reload, all pages and saved client preferences. Verify 360/390/768/1440-pixel layouts, light/dark/high-contrast appearance, 125% text, keyboard focus, dialogs, reduced motion and browser security/console errors.
5. Check Configuration's effective permissions. If local file editing is disabled, enable it only through an explicit per-instance operator configuration change using the Core guide. That optional operation is separate from Dashboard deployment; do not replace complete configs or identities.
6. Finish real lifecycle, WSS reconnect/outage, role/revocation, configuration conflicts and cross-instance denial checks in isolated staging or an appropriate maintenance window. Capture exact versions, request IDs and Host audit evidence. Neither running VPS instance has been disturbed by this source work.

Rollback restores the previous Dashboard deployment. No credential, instance-layout or world-data migration is introduced.
