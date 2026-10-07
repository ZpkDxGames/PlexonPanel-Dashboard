# UI migration matrix

| Before | Decision / canonical owner | Proof |
|---|---|---|
| app/dashboard.tsx | Keep signed operation/selection logic; refactor one shell, lazy page composition | signed two-room mounted flow |
| app/dashboard.css | Replace complete file; tokens, reset, shell and feature rules in one entry | source hygiene + viewport browser matrix |
| app/overview-view-3-0.tsx | Replace → overview-view.tsx | stale/fresh/null and chart geometry tests |
| app/monitoring-views-2-1.tsx | Refactor → performance-view.tsx; delete unmounted OverviewView21, HealthSummary, Sparkline | no duplicate exports; reports tests |
| app/players-view-3-0.tsx | Refactor → players-view.tsx, sole Players workspace | roster/history/privacy tests |
| app/players-view-2-3.tsx | Keep behavior → player-roster.tsx, private roster composition | same scope/UUID/moderation behavior |
| app/console-view-3-0.tsx | Refactor → console-view.tsx | journal authority/cursor + rendered flow |
| app/infrastructure-views-2-1.tsx | Refactor → governance-views.tsx (Audit/Access) | immutable grant/revocation tests |
| app/server-view-2-1.tsx | Refactor → server-view.tsx | signed Host result and BUSY tests |
| app/settings-view-2-1.tsx | Refactor → settings-view.tsx | same preferences authority |
| app/management-views-2-1.tsx | Delete re-export bridge; direct imports | static import search |
| app/backups-view, configuration-view, communication-views | Preserve safety logic; replace styles/control hierarchy | existing complete flow regression |
| components/select.module.css | Refactor to shared tokens, preserve accessible combobox | keyboard/browser controls |
| lib/control-state.ts | Add optional capture/source metadata and service history to existing reducer | independent cadence and reorder tests |
| lib/data-source, fleet-feed, browser-store, scopes | Keep | no parallel transport/store |
| lib/ui-preferences + provider | Keep v1 schema and single storage key | persistence migration tests |
| Core, Host, both relay runtimes | Keep runtime/contract unchanged | generated contracts + relay regression |

The existing cache v1 reader is a bounded compatibility adapter for prior telemetry records. Missing new provenance is explicitly reported as legacy, never inferred as newly captured data. Existing optional applied-skin fallback remains because Core #97 is unmerged. No parallel renderer or feature flag retained.
