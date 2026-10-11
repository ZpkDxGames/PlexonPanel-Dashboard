
## 6.0.0 — prototype-led UI revamp (2026-10-11)

- Replaced the presentation layer with the supplied light-glass design and dark variant: shared tokens, 24px cards, five KPI cards, adaptive SVG charts and structured navy console.
- Preserved pairing, relay protocol 3, endpoints, signed scopes/capabilities, instance isolation, lifecycle/player/chat/plugin/backup/device workflows.
- Added first-class Files, Plugins, Worlds, Schedules and Logs destinations using existing contracts or explicit unavailable states. Console Chat/Plugins tabs remain.
- Added command history/autocomplete, semantic filters, duplicate/trace grouping, mobile More navigation, native palette, pixel fallback, reduced-motion paths and accessible chart tables.
- Changed first-load theme default to system; shortened the startup minimum to 250ms for responsiveness. No auth or backend schema break.
- Self-hosted Plus Jakarta Sans replaces Manrope. Demo and styleguide are excluded from production.
- Known gaps: plain editor, unsupported world/arbitrary task/plugin-toggle contracts, deferred full backup transfer/restore UI, and unexecuted live authenticated / physical-device compatibility certification. See docs/REVAMP_REPORT.md and docs/REVAMP_REVIEW.md.
