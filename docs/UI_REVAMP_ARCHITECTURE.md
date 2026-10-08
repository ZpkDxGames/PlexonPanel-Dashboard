# UI revamp design decision

Use one neutral operational interface: fixed desktop rail, compact selected-server header, one mobile drawer, scoped workspace, and separate global Fleet selection. Keep high-frequency values inside metric tiles; put source diagnostics in disclosures. One semantic CSS token vocabulary governs surfaces, border, text, focus, status, radius, density and motion. Feature classes are descriptive, with no historical version prefixes or override stylesheet. The Select module consumes these same tokens. All workspaces keep the same Panel, Badge, Empty and action primitives.

Retain native lightweight SVG and `chart-geometry` for bounded, extrema-preserving, gap-aware paths. Add one pure metric catalog/series/report adapter so Overview, Performance, tables and exports share field/unit/source/capture semantics. Report only browser-observed 1/5/15/30 minute windows, sample count, observed coverage and sample-based p95. Long-horizon storage is out of scope. Optional service fields are a browser projection of existing Host packets, not a wire-contract change.

Keep all authorization, bound confirmations, reducers and transport in their existing owners. Pages receive typed ViewProps, and heavy workspaces load only when selected. No new runtime dependency. No Core/Host change justified: existing signed packets already supply all necessary values. Protocol 3, schema 5, scopes, identity keys and deployment gate stay intact.


## Canonical ownership

| Concern | Owner | Boundary |
|---|---|---|
| Composition, navigation, selection, bound confirmation | `app/dashboard.tsx` | One shell; lazy active workspace; immutable server/session target |
| Appearance and persistent presentation preferences | `lib/ui-preferences.ts`, `components/ui-preferences-provider.tsx` | One strictly parsed v1 store; no write bridge or second manager |
| Reset, tokens, responsive layout and feature classes | `app/dashboard.css` | `--ui-canvas`, surfaces, text, border, focus/accent, status, spacing, radius and duration; Select/legacy cleanup modules consume these tokens |
| Shared controls | `app/control-views.tsx`, `components/select.tsx`, `components/player-head.tsx` | Panel/Badge/Empty/ActionButton, combobox, safe avatar; policy remains outside primitives |
| Metric normalization, observations, statistics, exports | `lib/metric-reports.ts` | One field/unit/source/cadence catalog; explicit legacy provenance; no private content export |
| Window/gap/decimation math | `lib/chart-geometry.ts` | Pure bounded paths and extrema-preserving thinning |
| Chart rendering and inspection | `app/telemetry-chart.tsx` | Sole SVG renderer; measured canvas keeps axes readable; Resize/Intersection observers disconnect on unmount |
| Streaming, per-server reduction and Fleet sessions | `lib/data-source.ts`, `lib/control-state.ts`, `lib/fleet-feed.ts` | Existing signed pipeline and isolation; additive browser history metadata only |
| Freshness and presentation clock | `lib/telemetry-clock.ts`, `lib/telemetry-freshness.ts`, `lib/display-cadence.ts` | Capture and receipt remain distinct; graphics cadence does not delay operational state |
| Private player journal | `app/players-view.tsx`, `app/activity-history-modal.tsx` | Scope-controlled transient Paper queries; legacy browser reader is a separate bounded cleanup adapter only |

New history entries retain independent Paper-health, Paper-system, Host-system and service capture timestamps. A Host arrival may update its own observation but cannot increase Paper sample count. The same adapter supplies Overview sparklines, Performance charts, table alternatives and safe CSV/JSON exports. Browser observations and sampled statistics remain explicitly bounded to the chosen 1–30 minute window; unavailable data and elapsed gaps stay unavailable.

The design uses the existing compact/comfortable/spacious preferences, grayscale defaults, restrained optional accents and opacity/transform motion. Mobile uses one 42px menu control and drawer, 44px navigation targets, inert closed content and a visible-control focus trap. Reduced/off motion and the operating-system reduced-motion floor disable nonessential animation. No component library, chart runtime, animation engine or new transport/store dependency is introduced.
