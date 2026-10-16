---
name: plexonpanel-visual-systems
description: Design, implement and review PlexonPanel frontend presentation, responsive layouts, telemetry charts, Minecraft player identity, terminal workflows and Host backup evidence while preserving Protocol 3, scoped actions and production boundaries. Use for the Strata dashboard implementation and subsequent visual interaction work.
---

# PlexonPanel Frontend Visual Systems & Interaction Engineering

Use this playbook with the adjacent design specification, parity matrix and QA plan. It is supplied as a project document for the separate execution chat; do not install or publish it as part of dashboard work.

## Read the evidence before drawing the interface

Read `SOURCE_AUDIT.md` and verify current source identity. Open the route, its selectors/projections, the action gate and the matching backend handler. Classify observations as SOURCE, RENDERED, MEASURED, DOCUMENTED or HYPOTHESIS. A screenshot of a fixture proves composition, not a real connected server.

For a requested control, trace: UI entry → action string → canonical scope → agent kind → cloned target parameters → review → transport acknowledgement → authoritative result. If any link is absent, label it unsupported and omit the active control. Do not fill gaps with plausible APIs.

Use `FEATURE_PARITY_AND_RISK_MATRIX.md` for action mappings and `PLEXONPANEL_NEXT_GEN_DESIGN_SPEC.md` for exact geometry and component grammar. Keep decisions in those documents rather than duplicating competing token tables here.

## Compose a Strata workspace

1. Establish the selected server and route in the masthead. Keep action authority visible during scrolling and in every review.
2. Place the route's principal task first: inspect signals, find a player, operate the terminal, assess the current job, inspect audit, or change a browser preference.
3. Use one connected work surface with meaningful internal dividers. Do not wrap every label or number in another rounded card.
4. Place evidence adjacent to the reading/action it qualifies. Put raw diagnostics in a disclosure; never hide a reason that prevents execution.
5. Use an explicit desktop grid and a deliberate mobile order. Do not rely on source-order coincidence or horizontally compress desktop panels.
6. Render dark and light together. Make typography and state labels readable without accent color.

Keep all stored accent choices meaningful; action color, chart signal and semantic status are separate roles. Use original block geometry only for server/world/head identity. No continuous ambient movement or fictional landscape telemetry.

## Define data display before visual decoration

Model each displayed reading as value + unit + source + capture + receipt + state. A wrapper may read existing projection results; it must not become a new telemetry store.

| Input | Correct treatment | Anti-pattern |
| --- | --- | --- |
| Service CPU 150%, valid one-core metadata | `150% · 1.5 core-equivalents` if derived label is used; retain original percent | 100% clipped utilization ring |
| Missing TPS | `—`, “Waiting for Paper sample” | 0 TPS and red outage chart |
| Valid observed zero players | `0`, with source state | Empty dash or fabricated offline state |
| Stale heap | Last observed number explicitly labeled stale; no current-capacity meter | Fresh-looking gauge because its denominator exists |
| Upload progress 100%, remote verification unknown | “Transfer reported complete; remote verification pending/unknown” | “Backup complete” toast |
| Agent SUCCESS returning job ID and QUEUED | “Host accepted job”; navigate/refresh durable status | Treating action success as archive success |
| Selected UUID disappears | Stable absent-identity panel, no new action target | Select first remaining roster entry |

Use `sourceEvidence`, `historyFor`, `SourceEpochs` and `displaySegments`. Preserve raw observations and actual timestamps. Keep gaps and extrema; no curve interpolation across missing samples. In comparison, share the inspection timestamp but report each source's actual nearest timestamp. An observation outside the selected domain must not masquerade as a simultaneous sample.

## Design an operation, not just a button

Use verb-specific entry labels: “Review restart”, “Review ban”, “Review upload retry”. The prepared review shows exact server ID/name, agent, operation and target ID plus parameters. Keep the existing typed-subject policy and confirmation flags. Escape/Cancel does not pretend to cancel a Host job.

For unavailable actions, display the reason beneath the action group or in a focusable adjacent disclosure. The explanation can distinguish no scope, disabled capability, agent offline, association mismatch, stale service evidence and busy state only where source evidence supports it. Execution still uses `session.reason`; do not recreate a permissive gate from a role label.

For unknown outcomes, retain the request context and provide read-only status/audit inspection. Do not offer a one-click resend. For backup creation, explicitly separate acceptance, durable phase, local verification, remote verification and restart recovery.

## Handle difficult content deliberately

Use stable row keys: UUID, backup ID, device ID or existing event ID. Allow filenames, scopes and error messages to wrap. Truncate secondary display text only with a keyboard/touch-accessible full-text disclosure. Never truncate the unique target in a review.

Keep terminal messages as safe `FormattedText` segments. Support source/severity/text filters, pause without stopping ingestion, local clear/undo, local export, wrap and tail return. If font size changes, update measured virtualization row height; CSS line height and viewport calculations cannot disagree. Keep the latest-400 wrap bound visible.

Render player heads as fixed-size lazy images with local initials/voxel fallback. Reset load/error state for provider+UUID changes. Do not add a 3D skin canvas, external fallback cascade or unsolicited provider request.

## Make interaction accessible by construction

Use semantic HTML and native inputs where possible. Give tabs one selected item and keyboard navigation. Restore focus after dialogs or in-page profiles. Announce errors and completed operations; do not announce each console line or telemetry tick. Use a manual inspect action for chart readings.

Reserve skeleton geometry without loading shimmer. Respect stored off/reduced and OS reduced motion. Animate opacity/short transforms only for user-triggered transitions, never the value, shape or timeline of telemetry. Keep minimum 44px touch targets; compact desktop controls may be 36px high with sufficient spacing. Test visible focus and virtual keyboard visibility.

## Measure before changing subscription or rendering strategy

Read the QA plan for canonical budgets. Capture baseline and candidate on the same browser, viewport, machine and workload. Retain lazy routes and bounded histories. Memoize projections by actual input identity; do not suppress legitimate telemetry updates to improve frame statistics.

Profile the focus chart and eight-track comparison separately. Inspect resize feedback loops, repeated formatter construction, observer cleanup, crosshair-wide rerenders and terminal DOM count. If a protection-layer change is necessary, isolate it and prove behavior, not just speed.

## Review checklist for each route

- Confirm every pre-existing action/read feature is accounted for in the matrix.
- Capture 1440×900 and 390×844 in dark/light with readable target identity and fixture label.
- Exercise denied, missing, stale and disconnected data; verify there is no fake zero/success.
- Exercise long strings, large text, keyboard, touch and reduced motion.
- Preserve focus and identity during a server/source switch and a late response.
- Record exact checks; classify blocked browser/live tests honestly.

## Package the result

Follow `DELIVERY_CHECKLIST.md`. Keep source-only, fixture-only and live-runtime claims separate. Produce a review-ready PR and retain a known frontend rollback commit/artifact. Never deploy, merge or run live server mutations as a side effect of visual QA.
