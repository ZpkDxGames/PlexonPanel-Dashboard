# Rendered visual review

Date: 2026-10-15 UTC
Branch: `ui/refinement-20261015`

## Automated rendered matrix

`npm run test:browser` rendered 37 cases in Playwright Firefox. Every case ran axe, a document-overflow check and a console/page-error check before saving a full-page PNG under `artifacts/browser/`.

| Coverage | Cases |
| --- | --- |
| Every workspace | Fleet, Overview, Performance, Players, Console/Chat/Plugins, Backups, Access/Audit and Settings |
| Required widths | 360, 390, 768, 1024, 1440 and 1920 px |
| Theme / density / motion | dark + comfortable + full; light + spacious + reduced; light + compact + off |
| Accent contrast | Teal, Azure and Violet in both light and dark |
| Chart preference | Filled and no-fill Overview charts |
| Operational states | healthy, partial evidence, Host/Paper offline and denied access |
| Keyboard interactions | Ctrl/Cmd+K navigation and mobile-drawer Escape close |

Result: zero axe violations, zero document overflow cases and zero browser console/page errors. The selected root attributes were asserted in each preference case so a default-theme screenshot cannot masquerade as a light, density or motion check.

## Manual screenshot review

All generated workspace screenshots were inspected as dark-desktop, light-tablet and light-mobile contact sheets. Individual high-resolution review covered Overview, Performance, Settings, Console and Backups, plus Azure/Violet, chart-fill-off, partial, offline and denied states.

Observed outcomes:

- The six Overview metrics remain the strongest hierarchy without crowding the chart evidence below.
- Paper process CPU and Host CPU remain visually and textually distinct in tiles, legends and provenance.
- Chart gaps remain open; first-draw area fills, current markers, threshold lines, axis units and narrow-card layouts read correctly.
- The 1/5/15/30-minute control, terminal toolbar, player action hierarchy and backup degraded/retry state remain scannable.
- Offline console authority renders `UNAVAILABLE`; the footer says authority is unavailable and the composer remains disabled.
- Offline backup preflight renders unknown values, a disabled creation action and a visible Host-offline error. No backup availability is inferred.
- Denied Access shows only the effective Viewer grant and an explicit permission error without leaking unavailable records.
- The fixed mobile bottom navigation overlays no actionable control at the active viewport; full-page screenshots show its fixed viewport position by design.
- Both palettes use deliberate surface layering and readable shadows/borders. All accent/theme combinations passed axe contrast checks.

## Before / after evidence

Four baseline screenshots were rendered from commit `0ccb709038d17209a50db4fddf70a35948c4988f` in an isolated detached worktree: desktop Overview, desktop Settings, phone Overview and phone Console. Matching after screenshots are in the browser matrix. Artifacts are intentionally git-ignored.

## Scope boundary

This is source and synthetic-fixture presentation evidence. No claim is made for a real Paper/Host session, real action dispatch, physical phone, Safari or screen-reader acceptance. Production fixture exclusion remains structurally enforced by the Vite build.
