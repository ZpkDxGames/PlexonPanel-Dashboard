# PlexonPanel Dashboard 3.0.0 — Control Room

Dashboard 3.0.0 rebuilds the active PlexonPanel browser experience as an adaptive operations Control Room while preserving signed protocol 3, `/v1` relay routing, immutable device grants, Paper/Host agent separation, local capability authority, confirmation requirements, and existing credential compatibility.

## Highlights

### Control Room visual redesign

- Consolidated 3.0 presentation layers establish semantic spacing, motion, z-index, status, responsive, and workspace composition rules over the previously layered 2.1/2.3 shell.
- The default direction remains dark, data-first, and restrained: Plexon cyan is the default accent, surfaces use subtle depth, typography stays crisp, and status is conveyed by text/shape as well as color.
- Layout corrections enforce `gap`, deliberate line-height, `min-width: 0`, safe wrapping, and local overflow so adjacent text, badges, controls, and cards no longer visually merge.

### True adaptive layout instead of scaled desktop UI

- 3.0 does not use global `transform: scale(...)`, CSS `zoom`, or a JavaScript viewport scaling ratio.
- The shell uses Grid/Flexbox, intrinsic sizing, named containers, container queries, dynamic viewport units, safe-area insets, and breakpoint-specific composition.
- Narrow workspaces change columns, toolbar priority, chart summaries, drawers, metadata density, and navigation mode while keeping readable typography and touch targets.
- Wide and ultra-wide layouts gain additional useful columns instead of stretching text/card surfaces across the full monitor.
- Short-height laptop rules reduce chrome and decorative spacing without shrinking controls or type.

### Operational Overview

- New compact status strip surfaces overall/Paper/Host state, Minecraft version, uptime, player count, and latest visible update.
- TPS, MSPT, CPU, memory/heap, and players are separate primary signals with raw-history sparklines and compact trend context.
- Health summary shows active problems instead of occupying the page with a large green success panel.
- Recent player presence activity and world activity remain available as secondary operational context.

### Performance presentation

- Existing raw browser-local history, gaps, min/avg/max/p95, threshold/reference cues, keyboard inspection, line/area modes, pause, time windows, and raw export are preserved.
- Narrow chart presentation no longer relies on the old 560px minimum SVG canvas and normal horizontal scrolling.
- Chart grids, summaries, annotation density, padding, and height adapt to available workspace width while retaining the stable internal SVG viewBox and raw values.

### Players and Console polish

- Players retains the established roster/head/history/action behavior while improving table rhythm, sticky headers, card spacing, metadata hierarchy, and drawer/sheet geometry.
- Player/device drawers are top-layer side drawers on desktop and safe-area-aware full-width sheets on mobile.
- Console receives a dedicated 3.0 workspace with higher useful vertical density and a simpler toolbar.
- Scrolling upward automatically disengages live-tail following. Incoming lines accumulate behind a bounded “new lines / return to live tail” affordance instead of forcing the operator back to the bottom.

### Simplified Audit

- Audit is now a scan-first operational timeline rather than a large filter/table wall.
- Search, source, refresh, and result count stay prominent.
- Actor/action/outcome/time filters are available behind a compact disclosure.
- Primary event presentation emphasizes time, actor/device, action, target, and outcome.
- Request IDs, duration, raw JSON, and copy actions remain available under expandable advanced event details.

### Simplified Access

- Access starts with the current browser identity, role, server, connection, issue time, expiry, and forget/pair controls.
- Capabilities are summarized into Monitoring, Players, Console & Chat, Plugins, Server, Security / Access, and Advanced / Future.
- The exact Paper Policy / Host Policy / This Device matrix remains available under **Advanced capability details**.
- Locally enabled scopes absent from an immutable device grant produce explicit re-pair guidance; existing grants are never silently expanded.

### Simplified Settings + Display update rate

Settings is grouped into Appearance, Layout, Motion, Performance charts, Players, Browser data behavior, and Diagnostics.

A new browser-local **Display update rate** controls visible React commit cadence:

| Mode | Visible commit cadence |
| --- | ---: |
| Realtime | immediate / next eligible commit (`0 ms`) |
| Fast | at most every `250 ms` |
| Balanced | at most every `500 ms` — default |
| Relaxed | at most every `1000 ms` |
| Low activity | at most every `2000 ms` |

The WebSocket itself is not slowed. Every authorized message is still received, validated, and reconciled into authoritative latest state. Replaceable presentation state coalesces through one shared dashboard scheduler; ordered console/chat streams remain ordered inside authoritative state. Critical connection, authorization, lifecycle, confirmation, action-result, credential, and pairing state bypasses the visual cadence where applicable.

### Viewport-centered overlays

- Confirmation and command dialogs now use fixed top-layer geometry relative to the actual viewport.
- Centering no longer depends on the content column, sidebar width, page scroll, or a transformed/scaled workspace ancestor.
- Dynamic viewport height and safe-area-aware sizing keep overlays reachable at narrow widths and zoomed layouts.
- Toast and drawer tiers use semantic z-index ordering rather than unrelated page-local values.

## Files and Backups scope decision

**Files and Backups are intentionally not exposed as dashboard pages in Dashboard 3.0.0.**

They are removed from active sidebar navigation, command-palette page destinations, normal quick actions, and section routing. Existing protocol scopes and Paper/Host backend support are not deleted. Their capability entries remain visible only under Access → **Advanced / Future**, preserving security transparency and allowing future restoration without a wire-protocol redesign.

## Protocol and security compatibility

Dashboard 3.0.0 remains on signed protocol 3. It does not change:

- `/v1` relay routing;
- existing device credentials;
- immutable role/scope grants;
- Paper/Host identity separation;
- local Paper/Host policy authority;
- capability checks;
- high-risk confirmation requirements;
- cached-data safeguards;
- relay signing identity or Durable Object authority model.

UI preferences, including Display update rate, cannot grant scopes or enable local capabilities.

## Validation gates

Repository gates for this release remain:

```sh
npm ci
npm run check
npm run relay:smoke
npm run build
```

Dashboard 3.0 also carries regression tests for the reduced active page set, dormant Files/Backups compatibility hooks, supported display-rate values, 3.0 style-layer ordering, and the prohibition on global UI scaling in the authoritative 3.0 CSS.

Passing CI is not production deployment approval. Interactive paired-dashboard viewport, zoom, accessibility, failure-state, and disposable-live-server validation remain required before production promotion. See `docs/VALIDATION_3.0.0.md`.
