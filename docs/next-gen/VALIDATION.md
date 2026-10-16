# Local validation register

This register distinguishes source contracts, synthetic browser execution and unexecuted production/physical acceptance. All fixture browsers block nonlocal requests. No real pairing, relay, agent, provider or VPS operation was used. Dependencies, Protocol 3 and protected correctness/configuration files are unchanged.

## Source identities

- Frontend base: `4357a66bc674fddce7432cbc27a4fead00ac8234` (verified local main and remote main before edits).
- Backend contract reference: `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128` (read only).
- Feature branch: `design/strata-next-gen-20261016`.
- Final product, build, evidence and review-tip identities are recorded in the delivery manifest. Screenshot metadata names its actual capture source; earlier diagnostic failures are retained separately.
- Node 24.19.0, npm 11.9.0; pinned Playwright 1.64.0 / Firefox 157.0. Same locked packages in both worktrees. No lint script exists.

## Executed checks

| Gate | Result | Evidence / scope |
| --- | --- | --- |
| Baseline `npm run check` | PASS: 61 | `baseline-check.log`; independent base worktree |
| Candidate `npm run check` | PASS: 63 | TypeScript and contract/unit tests; two additional inspection/time tests |
| Production build | PASS | `npm run build`; build.json identifies source and builtAt |
| Package audit | PASS: 0 vulnerabilities | `npm audit --omit=dev --audit-level=high`; recorded on 2026-10-16 |
| Existing browser suite | PASS: 37 | `browser-check.mjs` |
| Control-plane checks | PASS: 25 groups | `control-plane-check.mjs` |
| Reconstruction workflow checks | PASS: 12 | `reconstruction-check.mjs` |
| Reference behavior checks | PASS: 7 | `reference-check.mjs` |
| Reviewed-action simulations | PASS: 5 | `review-confirmation-check.mjs`; synthetic only |
| New concrete regressions | PASS: 11 | `nextgen-check.mjs`; full log plus strengthened Q11/Q12 rerun |
| Prepared exact-target parity | PASS: 14 | `nextgen-action-parity.mjs`; 11 player families and backup verify/delete/retry, prepare/cancel only |
| Token contrast | PASS: 130 calculated pairs | Both themes, accents, semantic states; `contrast.json`; not complete WCAG certification |
| Production fixture isolation | PASS | `production-check.mjs`; fixture URL retains unpaired gate and fixture data/module excluded |
| Full layout/state matrix | PASS: 224 cases + 64 durable/shared states | Zero axe/page/overflow failures; timed splash axe explicitly not executed |
| Exact viewport focus/reflow | PASS: 128 | All eight routes × seven exact sizes × two themes plus 320px large-text passes; skip-link hash/focus preserved |
| Forced colors / OS reduce / UTC | PASS: 16 | All eight routes at desktop/mobile; real UTC output and raw clocks preserved; no formal AT claim |
| Native 200% zoom | BLOCKED | Control+= did not establish doubled DPR/halved CSS viewport; no CSS zoom or deviceScaleFactor substitute |
| Segmented-view/tab keyboard | PASS: 12 | Player tools, Access views and Console tabs at desktop/mobile dark/light |
| Search and warmed route response | PASS desktop / measured mobile unthrottled | Input p95 42/48ms and warm route p95 73/84ms; throttled-mobile remains BLOCKED |
| Paired short replay | PASS: five complete paired trials per mode | Focus 17.20ms, Overview 33.20ms, compare 50.44ms; all below project median gates |
| Sustained bounds/teardown | PASS: 600s each | Each retains ≤8,192 history / 2,500 console / 512 roster / 64 worlds; four exact target switches; zero chart/terminal DOM after unmount |
| Steady-input timing | FAIL | Five-pair median 33.34 →49.54ms, limit 36.674ms; blocks review readiness |
| `git diff --check` and protected diff | PASS | No backend, protocol, config, lockfile or credentials changes |

The five existing required suites are refreshed on final product source after the sequential sustained measurement, with a source-stamped suite.json and exact logs. Earlier stage failures remain diagnostics. Test count labels refer to their own suites, not one fabricated aggregate.

## Q01–Q32 scenario map

PASS below names the level actually executed. A passing source/contract test does not certify an agent response on a live host.

| ID | Evidence and local result | Acceptance limit |
| --- | --- | --- |
| Q01 | PASS: contracts and changed-target review browser | No real dispatch |
| Q02 | PASS: contracts, presentation-epochs and browser source-generation checks | Synthetic independent Paper/Host generations |
| Q03 | PASS: contract grant intersection and prepared-target invalidation | No live grant rotation |
| Q04 | PASS: queued acknowledgement contract remains pending until bound result | Transport simulated |
| Q05 | PASS: new browser Host SUCCESS/QUEUED receipt says job accepted, not complete | No actual backup |
| Q06 | PASS: one dispatch, unknown outcome, disabled resend, audit link | Synthetic timeout |
| Q07 | PASS: reference browser late UUID history response discarded | Query intercepted locally |
| Q08 | PASS: vanished UUID never retargets; final Back-focus test | Physical keyboard not tested |
| Q09 | PASS: intercepted provider failure/change and disabled zero-image requests | No external fictitious-player request |
| Q10 | PASS: console error-only authority/filter/export checks | Server enforcement retained, not live audited |
| Q11 | PASS: ingestion/pause/scroll/Return to live and retention | Synthetic 2,500 lines |
| Q12 | PASS: reproduced resize tail loss, fixed and strengthened browser assertion | No physical device |
| Q13 | PASS: text-format adversarial bounded inert segment tests | No raw HTML rendering |
| Q14 | PASS: command/capability contracts and reviewed plugin UI | No live reload |
| Q15 | PASS: failed preflight displays returned error and Unknown checks, blocks create | Structured failed-stage data unavailable in current query error contract; not invented |
| Q16 | PASS: browser expiry disables creation and labels historical checks | Controlled local clock |
| Q17 | PASS: final mismatched-job browser test plus durable-state source review | Host progress simulated |
| Q18 | PASS: 100% transfer does not create remote verification | Synthetic status/progress |
| Q19 | PASS: degraded local proof and exact existing archive retry target | Prepare/cancel; no shutdown/upload |
| Q20 | PASS: recovery-required authoritative gate blocks create | No recovery journal operations |
| Q21 | PASS: independent preflight/inventory failure browser cases retain successful siblings | Queries intercepted locally |
| Q22 | PASS: final Host-to-Paper late audit response test | No live audit service |
| Q23 | PASS: current-browser revoke disabled; other revoke reviewed and Paper-bound | No real device revoked |
| Q24 | PASS: Owner missing capability/scope has no bypass | Signed fixture/report intersection |
| Q25 | PASS: preferences/startup fresh import and reference reload | Parser/storage unchanged |
| Q26 | PASS: blocked optional localStorage in-memory behavior and IndexedDB pairing contracts | No real credential used |
| Q27 | PASS: relay origin/session tests retain credential and send no token on mismatch | Stub transport |
| Q28 | PASS: freshness tests and skew fixture | Capture/receipt distinction retained |
| Q29 | PASS: geometry/telemetry tests, pin/touch/keyboard/table checks | Rendering reduction preserves raw extrema/gaps |
| Q30 | PASS: fleet contracts, verified-node tests and 16-instance fixture | No unverified aggregation |
| Q31 | PASS: production isolation browser and output scan | Local production server only |
| Q32 | PASS: native dialog focus/Escape/return and narrow long-target layout; BLOCKED physical keyboard | No actual mobile virtual keyboard / assistive technology |

## Explicit limits

Native 200% browser zoom is BLOCKED by unsupported headless keyboard routing. Physical mobile/Safari, screen readers and physical keyboards remain NOT_EXECUTED. Effective 320px reflow and large text are measured separately. CPU-throttled mobile input and CLS need a browser-supported instrument; an unthrottled number is never substituted. Heap measurements are unsupported in Firefox; bounds and DOM teardown are reported instead of zero-growth claims. Live Host lifecycle, cold backups, provider integrity, device revoke, production pairing and deployed-version acceptance remain NOT_EXECUTED and require separate owner authorization.

The original remote publication authorization blocker was resolved by explicit owner approval of the exact feature-branch no-deploy guard; see PUBLICATION_BLOCKER.md. Publication checks and the remote receipt are recorded separately in DELIVERY_STATUS.md. The original product measurements retain their recorded source SHAs. No merge or deployment is authorized.
