# Control Room design system

The latest visual authority is `REFERENCE_UI_REVAMP_BRIEF.md`. Older Operations Desk design records are historical.

| Primitive | Decision |
| --- | --- |
| Canvas/sidebar/panel | #101624 / #151D2E / #1C2638 in dark; cool neutral canvas and white surfaces in light |
| Raised/inset | #263248 / #111A2A; separate controls and terminal from operational panels |
| Blue action | #2467D0 with white text; independently darker light-theme action |
| Signal | Cyan default; preserved blue/violet preferences; separate semantic success/warning/error |
| Type | Self-hosted Manrope and JetBrains Mono; 16px base with body/control scale mostly 14–16px, larger user setting at 18px base |
| Geometry | 16px main panels, 9–12px controls/rows, 44px principal controls, 20px module spacing |
| Desktop | 240px labelled grouped sidebar, compact breadcrumb/server header, full-size operational canvas |
| Tablet/mobile | Drawer at 820px, one-column Overview at 640px; source/target context retained |
| Charts | Existing exact-sample SVG renderer, gap/extrema reduction, independent units, original-sample table, source evidence |
| Motion | 180–200ms feedback/reveal, no animated telemetry interpolation; OS reduced and stored off/reduced respected |
| State | Loading, empty, denied, stale/skew, disconnected, unknown outcome, busy and successful agent result remain distinct |

Appearance values persist with the original schema. Teal is presented as Cyan in the new art direction. Resource capacity meters require a fresh usable source, finite numerator, positive reported denominator and numerator within capacity. Cgroup CPU is a numeric reading with explicit one-core denominator and no 100% meter.
