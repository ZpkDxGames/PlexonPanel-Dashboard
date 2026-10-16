# Operations Desk — frontend release

Rebuilds the Minecraft operations frontend with horizontal workspace navigation, a full-width tick canvas, an eight-signal instrument browser, server/player directories, a native player inspector, terminal/chat/plugin workbench, archive/runbook, audit-first Access views, an anchored settings document and centered provisioning.

Production: https://plexon-panel-dashboard.vercel.app

Frontend reconstruction: https://github.com/ZpkDxGames/PlexonPanel-Dashboard/pull/88

![Operations Desk desktop and mobile previews](https://raw.githubusercontent.com/ZpkDxGames/PlexonPanel-Dashboard/dashboard-operations-desk-2026.10.15/docs/releases/operations-desk-preview.png)

Preview data is synthetic and isolated to development fixtures.

The owner explicitly authorized frontend production deployment and GitHub release publication on 2026-10-15. This release preserves Protocol 3, IndexedDB pairing, grants, immutable action targets, WebSocket ownership, Host/Paper authority and backup safeguards. It does not deploy or restart Paper, Host, relay or VPS services; alter server configuration; replace JARs; rotate credentials; or migrate backend data.

## Validation

- 58 tests pass, preserving all original 48 contracts.
- Recorded local Firefox acceptance: 37 browser matrices, 32 desktop/mobile dark/light captures, 25 operational groups, 12 new interaction groups and five reviewed-dispatch simulations.
- Final compiled-production smoke: fixture query ignored, protected pairing gate, masked code and disabled incomplete claim; no axe findings or page errors.
- Build, production dependency audit and unchanged 180 KiB initial-JS budget pass. Initial JS is 89,567 gzip bytes, 21.6% below the main baseline.
- Focused instrument improves p95 in the recorded replay; eight-track comparison costs more CPU/replay time. Exact measurements and limits are in docs/NEW_DASHBOARD_VERIFICATION.md.
- The release workflow repeats contract, build, fixture-exclusion, audit and budget gates before publishing assets.

Live paired Paper/Host actions, Chromium/Safari, physical devices, screen readers, 200% browser zoom and a real 24-hour soak remain pending. The release does not certify those unexecuted cases.

## Assets

- `PlexonPanel-Operations-Desk-source.zip`: exact tagged source tree.
- `PlexonPanel-Operations-Desk-web.zip`: compiled static frontend; use the existing approved hosting security headers and relay configuration.
- `PlexonPanel-Operations-Desk-verification.tar.gz`: automated release logs, size result, parity, compatibility and rollout records.
- `build.json`: exact build commit and timestamp.
- `operations-desk-preview.png`: desktop and mobile visual contact sheet.
- `SHA256SUMS.txt`: asset integrity checksums.

## Rollback

Before this rollout the public production build reported commit `4295d16e6ecac0be27b0142e20b1b69c78862c66`, built 2026-10-15T19:49:48.404Z. Preserve its immutable frontend deployment:
https://vercel.com/zpkdxgames-projects/plexon-panel-dashboard/H5wg1h4FSqZmTzdSqi2EKaeTr2jJ

If frontend rollback is needed, restore that existing deployment to the same production origin. Keep the IndexedDB pairing and current relay allowlist. No Paper/Host/relay restart, JAR replacement, server-data reversal or secret change is required. See docs/NEW_DASHBOARD_ROLLOUT.md for the separate live-acceptance procedure.
