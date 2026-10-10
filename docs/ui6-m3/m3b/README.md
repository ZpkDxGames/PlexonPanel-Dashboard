# M3b production evidence

Completed 2026-10-08 UTC on `release/6.0.0`. Chromium 153 headless-shell, software rendering, signed local two-room fixture; no live server was operated. Evidence build: `R2qMbEzCng4u6Q6Fr8CAY`. Accepted 5.0 captures remain untouched. [Milestone report](../../UI_6_M3_REPORT.md), [raw axe/keyboard results](shell-verification.json), [compact summary](summary.json).

## Shell matrix

Existing Overview is retained within the new shell; these captures do not claim an M4 Overview redesign.

| Width | Light | Dark |
|---|---|---|
| 360 | [Screenshot](shell-light-360.png) | [Screenshot](shell-dark-360.png) |
| 390 | [Screenshot](shell-light-390.png) | [Screenshot](shell-dark-390.png) |
| 768 | [Screenshot](shell-light-768.png) | [Screenshot](shell-dark-768.png) |
| 1024 | [Screenshot](shell-light-1024.png) | [Screenshot](shell-dark-1024.png) |
| 1280 | [Screenshot](shell-light-1280.png) | [Screenshot](shell-dark-1280.png) |
| 1920 | [Screenshot](shell-light-1920.png) | [Screenshot](shell-dark-1920.png) |

## Open shell states

Each cell links light / dark captures. These 42 overlay states, all 12 Overview/shell captures, eight boot/pairing captures, four Fleet-shell scans and the activity tray have zero new-shell axe violations. Whole retained Fleet was separately scanned and still fails `definition-list` in four cases.

| Width | Connection authority | Navigation palette | Shortcuts | Drawer |
|---|---|---|---|---|
| 360 | [Light](authority-light-360.png) / [Dark](authority-dark-360.png) | [Light](palette-light-360.png) / [Dark](palette-dark-360.png) | [Light](shortcuts-light-360.png) / [Dark](shortcuts-dark-360.png) | [Light](drawer-light-360.png) / [Dark](drawer-dark-360.png) |
| 390 | [Light](authority-light-390.png) / [Dark](authority-dark-390.png) | [Light](palette-light-390.png) / [Dark](palette-dark-390.png) | [Light](shortcuts-light-390.png) / [Dark](shortcuts-dark-390.png) | [Light](drawer-light-390.png) / [Dark](drawer-dark-390.png) |
| 768 | [Light](authority-light-768.png) / [Dark](authority-dark-768.png) | [Light](palette-light-768.png) / [Dark](palette-dark-768.png) | [Light](shortcuts-light-768.png) / [Dark](shortcuts-dark-768.png) | [Light](drawer-light-768.png) / [Dark](drawer-dark-768.png) |
| 1024 | [Light](authority-light-1024.png) / [Dark](authority-dark-1024.png) | [Light](palette-light-1024.png) / [Dark](palette-dark-1024.png) | [Light](shortcuts-light-1024.png) / [Dark](shortcuts-dark-1024.png) | Desktop rail |
| 1280 | [Light](authority-light-1280.png) / [Dark](authority-dark-1280.png) | [Light](palette-light-1280.png) / [Dark](palette-dark-1280.png) | [Light](shortcuts-light-1280.png) / [Dark](shortcuts-dark-1280.png) | Desktop rail |
| 1920 | [Light](authority-light-1920.png) / [Dark](authority-dark-1920.png) | [Light](palette-light-1920.png) / [Dark](palette-dark-1920.png) | [Light](shortcuts-light-1920.png) / [Dark](shortcuts-dark-1920.png) | Desktop rail |

## Boot, pairing and retained Fleet

| State | Width | Light | Dark |
|---|---|---|---|
| boot | 390 | [Screenshot](boot-light-390.png) | [Screenshot](boot-dark-390.png) |
| boot | 1280 | [Screenshot](boot-light-1280.png) | [Screenshot](boot-dark-1280.png) |
| pairing | 390 | [Screenshot](pairing-light-390.png) | [Screenshot](pairing-dark-390.png) |
| pairing | 1280 | [Screenshot](pairing-light-1280.png) | [Screenshot](pairing-dark-1280.png) |
| fleet-shell | 390 | [Screenshot](fleet-shell-light-390.png) | [Screenshot](fleet-shell-dark-390.png) |
| fleet-shell | 1280 | [Screenshot](fleet-shell-light-1280.png) | [Screenshot](fleet-shell-dark-1280.png) |

[Session activity, dark 1280](session-activity.png) retains metadata only, at most 50 items in this tab.

## Actual production load order

The runner holds the deferred workspace owner request, verifies that the shell is visible and legacy DOM is absent, captures it, and then releases the request. These four additional screenshots and traces prove order rather than a real-device latency budget. The supplemental CSS trace reused the same successful build; it did not run another build.

| Width | Light before workspace | Dark before workspace |
|---|---|---|
| 390 | [Screenshot](production-shell-before-workspace-light-390.png) | [Screenshot](production-shell-before-workspace-dark-390.png) |
| 1280 | [Screenshot](production-shell-before-workspace-light-1280.png) | [Screenshot](production-shell-before-workspace-dark-1280.png) |

[Fresh build and paint/CLS trace](production-shell.json), [explicit CSS-request trace](production-css-order.json), [cold-cache fonts and emitted CSS](production-font-trace.json), [bundles](bundle-after.json), [contrast/composites](contrast.json), [final full check](check.txt), [scope review](scope-review.json).

71 screenshots are retained: 67 matrix/state captures and four load-order captures. No debug-failure capture is presented as accepted evidence. Axe incomplete entries are preserved with live-DOM and rendered-color reviews. Shell-only CLS passes 0.05; retained mobile Fleet fails, as documented in the report.

Reproducible runners: `scripts/verify-ui6-shell-production.mjs` builds/starts the signed-fixture app; `scripts/verify-ui6-shell.mjs` accepts `UI6_MODE=production` for the matrix. Use `PLEXON_CHROMIUM_EXECUTABLE` for the local headless-shell binary and a valid system-library path when needed. Run the matrix against the fixture-configured build; `npm run check` creates its own separate test-configured build.
