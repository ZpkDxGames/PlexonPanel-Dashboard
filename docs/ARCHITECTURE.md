# Architecture

## Pinned references

Inspected on 2026-10-11 UTC:

| Reference | Commit | Use |
| --- | --- | --- |
| `ZpkDxGames/PlexonPanel-Dashboard`, `candidate/plexonpanel-dashboard-new` | `6ed1f622e96b82f923329397bcafce7c549df1ce` | Protocol-3 browser adapter, persisted credential, telemetry, fleet and action contracts only |
| `ZpkDxGames/PlexonPanel-Dashboard`, `main` | `d19f94f8e0092bf7ab802be0977959a5c65b7641` | Production reference and compatibility comparison |
| `ZpkDxGames/PlexonPanel`, `main` | `09deffc568e36828b4cb56c91f576b7f8524122c` | Relay/Core/Paper/Host action, telemetry and capability authority |

The legacy files required by the binding specification were read before visual implementation: the architecture, adapter contracts, capability map, relay integration report, specification, adapter modules and test suite. No reference repository was modified.

## Product boundary

This is a fresh React/Vite/TypeScript SPA with independent Git history. The interface is built from new tokens, primitives, navigation and page compositions. It preserves protocol 3 and does not change relay, Core, Host or Paper/plugin code.

Layering:

1. `src/adapter` — copied or minimally ported protocol/auth/freshness/action modules.
2. `src/store` — selected-server external store, bounded reducers and selector subscriptions.
3. `src/features` — workflow logic and capability gates.
4. `src/components` — visual primitives, charts, console formatter and skin renderer.
5. `src/routes` — lazy workspace composition.

Presentation never opens sockets directly. One selected connection owns action dispatch; passive fleet rooms are read-only and capped at 16. A server/session/authority change invalidates prepared actions. Queue acknowledgement is not completion. Mutations are never retried automatically.

## Route map

`Fleet` → `Overview` → `Performance` → `Players` → `Console & Chat` (Plugins tab) → `Backups` → `Access & Audit` → `Settings`.

The binding document includes Configuration/files, but the user's latest instruction explicitly excludes editing files through the dashboard. This route is intentionally omitted. No dormant file-write button or placeholder route will be shipped.

## Data truth

- Production starts empty and waits for authenticated service data.
- Application entry is stateful: an initialization flag prevents credential-storage races, a 2.8-second minimum splash covers local startup, and an initialized browser with zero valid credentials is routed to the dedicated pairing gate instead of the operational shell.
- Credentials remain only in IndexedDB `plexonpanel-browser-v3` / `workspace`; local storage contains non-secret preferences only.
- Relay precedence: saved browser origin → `VITE_PLEXON_RELAY_URL` → legacy `NEXT_PUBLIC_PLEXON_RELAY_URL` at build time → valid stored-pairing origin.
- Paper/Host capture and receipt clocks remain independent. Live ≤10 seconds, delayed >10 seconds and stale >30 seconds. A capture more than 5 seconds ahead expires by receipt time.
- The former page-wide yellow skew warning is replaced with a compact status disclosure. Raw offset remains available in source diagnostics and affected metric provenance; values are never timestamp-rewritten.
- Missing, zero, empty, stale, disconnected and denied are distinct states.
- Retention bounds remain: telemetry 8,192 points/35 minutes, console 2,500 lines, roster 512, worlds 64.

## Pairing entry flow

The first-run form collects only a recognizable device name and the server-issued one-time code when `VITE_PLEXON_RELAY_URL` is present. If the public relay variable is absent, the same form exposes a recoverable HTTPS-origin field. It calls the existing protocol-3 claim endpoint, rejects cross-relay WebSocket credentials, persists the accepted credential in IndexedDB, requests a fresh signed grant, and only then enters the operational connection lifecycle. Existing paired users retain the Settings workflow for adding another server.

## Runtime dependencies

Versions were checked against npm on 2026-10-11 and will be pinned in the lockfile.

| Dependency | Planned version | Justification |
| --- | --- | --- |
| React / React DOM | `19.3.0` | Component model, external-store subscriptions, accessible interactive workflows |
| Vite | `8.3.4` | Static SPA build and route chunking; supports Node 22.12+ |
| TypeScript | `7.0.2` | Strict static checking; current npm release |
| Motion | `14.1.0` | Purposeful route/list presence and layout animation with reduced-motion control |

Routing uses a small internal hash router to avoid an additional runtime dependency. Charts use project-owned SVG/Canvas primitives. Icons use one project-owned 1.75px SVG stroke set. No analytics SDK, dashboard kit, utility CSS framework or external CDN script is used. The initial 2D skin renderer uses validated provider URLs and deterministic local fallback; any 3D viewer remains lazy/deferred unless its cost and accessibility fallback pass verification.

## Security and hosting

The static Vercel configuration will provide SPA rewrites and CSP/security headers. CSP is generated around the configured public relay and approved skin providers; no secrets are build inputs. Console, chat, player, audit and service text are rendered as text/segment nodes—never `dangerouslySetInnerHTML`, `eval` or `new Function`. URLs are restricted to HTTP(S). Diagnostics are redacted by construction.

The existing production deployment and pairing stay untouched. A separate preview origin requires exact relay allowlisting and a fresh least-privilege device pairing. Those are live acceptance steps and will be reported as not executed unless actually run.

