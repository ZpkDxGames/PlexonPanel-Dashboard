# UI 6 M2 foundation report

2026-10-08 UTC, branch `release/6.0.0`. Decisions 11–13 are appended to [UI_6_DECISIONS.md](UI_6_DECISIONS.md) and the approved Pulse contract is reconciled in [UI_6_DESIGN.md](UI_6_DESIGN.md). M2 stops here; M3 has not started. No push, tag or deployment. Accepted 5.0 evidence and M0 findings are unchanged.

## Executed gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run check` | PASS; 79 relay + 201 dashboard tests, zero failures/skips | [Complete transcript](ui6-m2/check.txt) and [exit status](ui6-m2/command-status.json); includes lint, TypeScript, contracts and actual production build |
| Kitchen sink, light/dark × 390/1280 | PASS; four full-page PNGs | Links below; Chromium headless shell 153.0.8010.0, software rendering |
| Axe on each base page and each open Select/Menu/Popover/Dialog | PASS; 20 scans, zero violations | [Raw results](ui6-m2/kitchen-verification.json); incomplete checks and explicit supplemental reviews retained |
| Keyboard flows and themes | PASS at all four combinations | Select arrows/Home/End/typeahead/Enter/Escape, menu wrap/skips, popup close, dialog Tab trap/restore and nested select, manual tabs, disclosure; absent-key OS following and saved override/reload |
| Forced colors and 200% text at 390 | PASS; no document overflow | [Forced colors](ui6-m2/kitchen-forced-colors-390.png), [200% text](ui6-m2/kitchen-text-200-390.png) |
| Palette and new composites | PASS; 116 required pairs | [Measurements](ui6-m2/contrast.json), minimum text 5.1362:1; essential boundaries 3.8763:1 |
| Production font CSS + cold-cache `next build`/`next start` trace | PASS | [Trace and emitted faces](ui6-m2/production-font-trace.json) |
| Actual production route/chunk exclusion | PASS | [Manifest and emitted-file proof](ui6-m2/build-exclusion.json), automated `tests/ui-foundation-build.test.mjs`; HTTP 404 |
| Pure Pulse model | PASS; 12 unit tests, no UI/timer/storage | `tests/tick-pulse-model.test.mjs`; retained 8192-capture tests at 390/1920 |

The working browser is the genuine headless shell 153 used in M0, driven by installed Playwright 1.64; bundled Chromium 156 remains unavailable in this environment. Software flags include `--disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader`. This is executed engine-specific evidence. Real-device/other-engine/assistive-technology testing, rendered Pulse raster cost and M3–M8 gates are **not executed**.

## Screenshots

| Width | Light | Dark |
|---|---|---|
| 390 | [Full kitchen sink](ui6-m2/kitchen-light-390.png) | [Full kitchen sink](ui6-m2/kitchen-dark-390.png) |
| 1280 | [Full kitchen sink](ui6-m2/kitchen-light-1280.png) | [Full kitchen sink](ui6-m2/kitchen-dark-1280.png) |

Open-state screenshots use `select-`, `menu-`, `popover-`, `dialog-` + `<theme>-<width>.png` in `docs/ui6-m2/`; all 16 are included alongside the four main captures. The Next development indicator is visible in these development-only captures. The page contains clearly labelled primitive fixtures, never synthetic operational telemetry.

## Foundation and state coverage

`app/styles/foundation.css` declares `reset, tokens, base, primitives, workspaces, utilities`. Palette values match `docs/ui6-design/tokens.json`. New components contain no raw hex colors; `--ds-*` deliberately avoids collisions with the existing workspace `--ui-*` skin. The legacy stylesheet is scoped to `/` and `/activity`, retaining its current rules except that its body font consumes the new UI font token. Workspace replacement is deferred to later milestones. No runtime dependency, package version, protocol, relay, Core or Host code changed.

| Primitive | Kitchen states/behavior |
|---|---|
| Button | Primary, secondary, quiet, danger; enabled/hover/active/focus, disabled, busy, icon + text, named icon-only |
| Panel | Ready, loading, empty, error; heading and action composition |
| Badge | Verified, warning, failed, pending, unknown; separate shapes and words |
| Field | Normal, required, invalid/described error, help, read-only, disabled, identifier |
| Select | Selected/unselected/disabled options, invalid, disabled, empty/unavailable; keyboard/typeahead, focus restore; nested in dialog |
| Dialog | Closed inert content; open top layer, Escape, backdrop dismissal, explicit Tab wrap and opener restore |
| Popover | Closed/open/disabled; named disclosure, dismissal, top-layer content |
| Menu | Closed/open/disabled; enabled/disabled items, roving keyboard focus, Home/End/typeahead, close/restore |
| Tabs | Selected/unselected/disabled; manual activation with arrows/Home/End and inert hidden panels |
| Table | Data, row/column headers, empty and loading; named scrolling region and caption |
| Toast | All five tones, persistent/dismissible; status/alert semantics |
| Skeleton | Loading label and static decorative shapes; no idle animation |
| EmptyState | Empty copy with/without optional fixture action |
| Disclosure | Closed/open; native summary keyboard semantics, hidden content inert |
| Icon | 36 shared stroked SVG paths at 16/20 px; decorative hidden, standalone named example, named icon controls |

Migration preserves the v1 key, all five accent enums and every valid saved field. Only a truly absent key selects system theme/cyan; any present key, including empty/malformed/oversized/partial, uses the existing fallback values for missing or invalid fields. Legacy density/window migration still runs only for an absent key. Before-paint initialization is tested against runtime parsing, including dark/light OS preferences. Reset behavior keeps the existing stored-default path.

## Accessibility review

All 20 axe scans have zero violations. Raw **incomplete** entries remain visible: `aria-valid-attr-value` cannot resolve closed native popover targets in its virtual tree, and four open-popover scans cannot infer the opaque top-layer paragraph background because it overlaps the underlying page. The runner explicitly verifies every foundation controlled ID exists in the live DOM and each expanded value agrees with `:popover-open`; it measures the actual paragraph color and opaque popup background. Supplemental reviews resolve the paragraph contrast to 16.0955:1 light / 10.4857:1 dark. They are not falsely relabelled as axe passes.

Browser tests caught and corrected missing combobox names, native-dialog Tab wrapping, a skip-link landmark issue and text-200% control/icon-grid overflow. The existing canonical-stylesheet source assertion was revised to require the global layered foundation and route-scoped existing skin while retaining its legacy-overlap checks. The contradictory lifecycle assertion remains untouched for M3, as decision 1 requires. Fleet's baseline `definition-list` violation is still a future M4 zero-failure gate under decision 13.

## Contrast and composites

Text/status/accent values remain opaque. Hover uses the measured sunken surface. Disabled text remains readable; controls, invalid fields, selection and focus use essential boundary/accent tokens. Quiet panel separators are decorative and are never the only interactive boundary: their eight below-4.5 pairs are recorded, not treated as text passes.

New composite tokens are only a 55% backdrop and 18% floating shadow from the existing dark-sunken color. Their computed sRGB colors are:

| Theme | Base surface | 55% backdrop | 18% shadow |
|---|---|---|---|
| light | canvas | #797D7F | #CBCECE |
| light | surface | #7F8284 | #D5D6D7 |
| light | raised | #7F8284 | #D5D6D7 |
| light | sunken | #75797A | #C2C6C5 |
| dark | canvas | #181D22 | #191F24 |
| dark | surface | #1B2227 | #20272E |
| dark | raised | #1F272D | #273038 |
| dark | sunken | #161B1F | #161B1F |

Neither composite carries text or status. The modal makes its background inert. Content sits on the opaque raised surface: primary text 16.0955:1 light / 10.4857:1 dark, muted text 7.2407:1 / 6.9562:1, essential boundary 4.6206:1 / 4.0726:1. High contrast strengthens quiet boundaries; forced colors substitutes system colors.

## Vendored fonts and production proof

Assets and full OFL licenses are in `app/fonts/`; [MANIFEST.json](../app/fonts/MANIFEST.json) records SHA-256, bytes and source distributions. Exactly Hanken Grotesk (variable 100–900 UI) and Commit Mono 400 (restricted code/identifier uses) are designed faces; system fallbacks remain available. No font CDN or runtime font package is used.

The installed Turbopack emits custom `font-family` declarations correctly but does not carry that name into its generated local-font variable/class family names. The font tokens therefore reference the verified literal emitted shared family, `Plexon Hanken`, so both range-qualified Hanken faces join correctly. The generated variable classes include their CSS; the shared fallback metrics are retained. Production tests assert both Hanken ranges/weights and the Commit Mono 400 face.

| Cold-cache stage | Actual new font requests | Result |
|---|---|---|
| Production page load | Hanken Latin, 34,704 bytes, HTTP 200 | One preload, Latin only |
| Portuguese/English corpus | None | Hanken custom glyphs; extended remains unused |
| Add `Łukasz` | Hanken Latin-extended, 19,588 bytes, HTTP 200 | On-demand extended face; same Hanken family |
| Command specimen | Commit Mono 400, 48,128 bytes, HTTP 200 | On demand, never preloaded |
| Rare `Ж` | None | DejaVu Sans system fallback in this environment |

The trace is from actual local production output with browser cache disabled, actual emitted URLs mapped by binary SHA-256, and CDP rendered-font inspection. Normal tested precomposed Portuguese/English needs only the Latin payload. Universal script coverage is not claimed.

## Production exclusion

`next.config.ts` admits `page.dev.tsx` only in `PHASE_DEVELOPMENT_SERVER`. The development page alone imports private `_development` content/style; production default extensions cannot match it. The automated test reads the **actual** `.next/server/app-paths-manifest.json` and scans emitted server app/static chunks for `PLEXON_UI6_KITCHEN_SINK_DEV_ONLY` and leaked gallery CSS. It fails if output is absent/empty or if a marker/route is found. The actual production app has only `/`, `/activity`, `/api/build`, and framework error routes; `/dev/kitchen-sink` returns 404. Exclusion is compile-time routing, not a hidden production page or a runtime environment guard.

## Pure Pulse model and next boundary

`lib/tick-pulse-model.ts` consumes an explicit one-instance trusted-health capture input, observed window end, plot width and the existing report adapter's gap tolerance. It adds no source adapter, polling, receipt metadata, history owner or UI. It chooses raw only when the minimum adjacent spacing is ≥2 CSS px; otherwise it uses approximately 3 px summary buckets. Time buckets are half-open, with the final bucket including the exact window end. Each occupied bucket preserves count, worst known TPS category, independent unknown counts and actual MSPT min/max. All valid exact window captures stay separate and ordered; excluded future/invalid/outside-window captures remain diagnostic entries. Last exact-timestamp duplicate replaces; no metric interpolation or zero filling.

Exact gaps and unobserved start/end time are separately represented. Raster-facing hatch columns are bounded to `ceil(plotWidthPx)` and retain the amount of each kind of time within a pixel. Observed coverage measures capture-time spans within tolerance, independently of metric availability; it is not asserted to be valid-TPS/MSPT coverage. At 8192 retained captures, mobile summary marks are ≤130 and desktop ≤640, while all 8192 exact captures remain reachable by a later lens/table. This proves model bounds, not draw cost or rendered readability.

M4 must still test trusted-source joining, visible raw/summarized labels and spans/counts/extrema, actual hatching, exact lens/table parity, mobile/keyboard inspection, clipping/zero baselines, source cadence, freshness/frozen/offline behavior and redraw only on new captures. These UI/raster gates are **not executed** in M2. M3 shell/action extraction and Host-only correction are **not started**.

## Reproduction

```sh
npm run check
node scripts/measure-ui6-contrast.mjs
# Starts its own loopback dev server, then captures/axe/keyboard checks:
node scripts/verify-ui6-foundation.mjs
# Uses the production build created by npm run check and starts its own next start:
UI6_MODE=production node scripts/verify-ui6-foundation.mjs
```

On a machine with Playwright's shell installed, omit `PLEXON_CHROMIUM_EXECUTABLE`. In this environment use the already working shell/library-path overrides described in M0. Output goes to `artifacts/ui6-m2/`. Screenshots, raw reviews, emitted font CSS, trace, manifest/marker proof, command logs and source scripts are in `docs/ui6-m2/`; source scripts and tests remain in the repository. No M3 work or push is authorized by completing this report.
