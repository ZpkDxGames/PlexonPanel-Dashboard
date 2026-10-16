# Verification — Reference Control Room

Frontend baseline: `cea185cca07d9892967215baed097bedbe0e77ca`, reconfirmed as remote main on 2026-10-16. Backend reference: `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`, inspected read-only. The review branch is `design/reference-control-room`. This report supersedes the historical Operations Desk verification for this candidate.

## Executed gates

| Check | Actual result |
| --- | --- |
| Baseline install/check/build/performance | PASS; 58 original tests; initial JS 89,567 gzip bytes |
| Final `npm run check` | PASS; TypeScript and 61 tests, including all original 58 |
| Final `npm run build` | PASS; unchanged React/Vite architecture and pinned dependencies |
| `npm run test:perf` | PASS; 89,808 initial JS gzip bytes against unchanged 184,320-byte budget |
| Browser matrix | PASS; 37 route/state/preference cases; zero axe violations, document overflow or console errors |
| Control-plane checks | PASS; 25 groups, including all eight workspaces at eight widths, source states, pairing recovery, grant denial, immutable review and source generation |
| Reconstruction interactions | PASS; 12 groups covering sidebar, focused/eight-track charts, profile/focus restoration, Access views, Settings modules, large text and mobile navigation |
| Reference acceptance | PASS; seven groups: persisted preferences, exact UUID history/cursor, late-response isolation, vanished selection, plugin search, stale meters and Settings deep links |
| Reviewed-action fixtures | PASS; five simulated reviewed dispatches preserve required confirmation; typed ban guard retained |
| Main visual proofs | PASS; 32 captures: eight workspaces × 1440/390 × dark/light |
| Extended proofs | PASS; 32 additional captures for viewport Overview, profile, Settings modules, Chat, Plugins and pairing; two desktop usage-position assertions |
| Final Console/Backups proofs | PASS; eight refreshed captures after filter sizing and honest Host-phase styling |
| Production artifact | PASS; synthetic fixture data absent, fixture URL cannot bypass pairing, Protocol 3 build identity retained |
| Production dependency audit | PASS; zero vulnerabilities |
| `git diff --check` | PASS |

Local browser checks use headless Firefox and development fixtures with nonlocal traffic blocked and external skins disabled. No fixture can execute a real server operation. Browser/server launch together through `qa-local.mjs`. There is no lint script; TypeScript is checked by both check/build. Screenshots and complete JSON/log evidence accompany the handoff.

The protected adapter, library, capability, reviewed-action, entry-state, transport and source-history files are unchanged, as are package versions, lockfile, relay/CSP configuration and `vercel.json`. The single protected-area exception is a preference initialization-order bug fix: initialize `oneOf` before the first persisted read. It changes no storage schema or default. See compatibility and the fresh-module regression.

## Measured performance

All bundle measurements below use Node `zlib.gzipSync` defaults on clean production asset directories. They compare this task's actual main baseline with this candidate, not an older redesign.

| Artifact | Baseline | Control Room |
| --- | ---: | ---: |
| Initial JS gzip | 89,567 B | 89,808 B |
| All lazy/initial JS gzip | 121,697 B | 125,911 B |
| Compiled CSS | 95,501 B | 84,159 B |
| CSS gzip | 22,761 B | 20,666 B |
| JS asset count | 14 | 15 |

Initial JS increases 241 bytes (0.27%); CSS gzip falls 2,095 bytes (9.2%). Lazy loading and the existing budget remain intact. The added read-only player history is a separate lazy presentation module. No raw retention or source cadence changes were made.

Same-container development-build browser replay at 1440×900: 8,192 retained observations and 24 synthetic events spaced at 125 ms. Wall time also includes asynchronous rendering/inspection. These short, sequential runs measure local UI behavior, not production service load or sustained throughput.

| Replay | Baseline p95 frame interval | Control Room p95 | Baseline → candidate DOM nodes |
| --- | ---: | ---: | ---: |
| Overview | 49.44 ms | 33.28 ms | 633 → 889 |
| Focused Performance | 17.22 ms | 17.22 ms | 546 → 593 |
| Optional eight-track comparison, median of three runs | 50.48 ms | 83.50 ms | 915 → 962 |

Overview's bounded console preview memoizes rows and the existing safe text formatter. The focused instrument remains the default. Eight-track comparison is an explicit heavier mode: baseline p95 values were 50.48/66.12/33.34 ms, candidate 33.72/99.88/83.50 ms. It has a higher tail cost in these noisy short replays. This is a documented regression/limit, not a universal frame-rate improvement. Comparison uses one column below 1800px to preserve legibility and control concurrent plot width.

Console retains 2,500 lines while rendering 26 rows in the ordinary viewport and a bounded 400 in wrap mode. Raw telemetry remains bounded at 8,192 observations. Firefox exposes no `performance.memory` here; no heap-growth claim is made.

The existing display-path benchmark still preserves the spike, null gap and raw observations: 8,192 raw points → 474 display points, 194,828 → 11,316 path characters. This run recorded legacy median 2.185 ms, cached reduction 0.094 ms and cold reduction including copy 0.491 ms. That is an inherited isolated path comparison, not a new whole-app speedup over the current baseline. The underlying geometry/reduction implementation is unchanged.

## Pending live acceptance

Real paired Paper/Host/relay/VPS round trips, installed runtime/version verification, real lifecycle/destructive/backup operations, production origin approval, Chromium/Safari, physical phones, screen-reader hardware, 200% browser zoom and an actual 24-hour heap/browser soak were not executed. The passing reducer suite includes a virtual 30-minute retention exercise, which is not a real browser soak.

No production promotion, service restart, JAR replacement, credential/allowlist change, backend modification or state migration occurred. A Git preview does not imply paired-runtime acceptance or relay origin approval. Follow `NEW_DASHBOARD_ROLLOUT.md` for the separate safe acceptance and rollback procedure.
