# Strata review guide

The complete frontend transformation is on `design/strata-next-gen-20261016`, based on `4357a66bc674fddce7432cbc27a4fead00ac8234`. The owner approved draft-PR publication with the exact branch-only no-deploy guard; see PUBLICATION_BLOCKER.md and DELIVERY_STATUS.md. P7 still has failed/blocked gates. No owner review, merge or production authorization is implied.

Read VALIDATION.md for the exact test levels, PERFORMANCE.md for measured comparisons, PARITY_STATUS.md for all 88 feature IDs and ROLLBACK.md for recovery. The original planning Markdown is copied under planning/; its image/source-archive links refer to the original attached planning package, which remains the full input artifact.

## Eight-route visual review

Every route has a baseline capture and a candidate viewport/full-page pair in desktop/mobile dark/light. The table links the compact PR evidence; the delivery archive retains all full-page and nested-state proofs.

| Route | Resulting composition | Desktop dark | Mobile light |
| --- | --- | --- | --- |
| Fleet | Connected instance ledger; explicit passive feeds and verified-node context. | [Before](evidence/screenshots/baseline/fleet-1440-dark.png) / [After](evidence/screenshots/candidate/fleet-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/fleet-390-light.png) / [After](evidence/screenshots/candidate/fleet-390-light-viewport.png) |
| Overview | Selected entity, four readings, usage instrument and eight-line console before infrastructure/world/player facts. | [Before](evidence/screenshots/baseline/overview-1440-dark.png) / [After](evidence/screenshots/candidate/overview-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/overview-390-light.png) / [After](evidence/screenshots/candidate/overview-390-light-viewport.png) |
| Performance | Signal catalog and focused instrument; eight-track comparison, actual-capture inspection shelf and sample table. | [Before](evidence/screenshots/baseline/performance-1440-dark.png) / [After](evidence/screenshots/candidate/performance-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/performance-390-light.png) / [After](evidence/screenshots/candidate/performance-390-light-viewport.png) |
| Players | Exact-UUID roster/profile, Interact/Moderate/Commands, history and provider-isolated head fallback. | [Before](evidence/screenshots/baseline/players-1440-dark.png) / [After](evidence/screenshots/candidate/players-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/players-390-light.png) / [After](evidence/screenshots/candidate/players-390-light-viewport.png) |
| Console | Measured terminal viewport, follow/inspection state, explicit return to live; Chat and Plugin inventory preserved. | [Before](evidence/screenshots/baseline/console-1440-dark.png) / [After](evidence/screenshots/candidate/console-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/console-390-light.png) / [After](evidence/screenshots/candidate/console-390-light-viewport.png) |
| Backups | Durable Host job and local/remote proof precede inventory; preflight/error/expiry and accepted-job distinctions are explicit. | [Before](evidence/screenshots/baseline/backups-1440-dark.png) / [After](evidence/screenshots/candidate/backups-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/backups-390-light.png) / [After](evidence/screenshots/candidate/backups-390-light-viewport.png) |
| Access | Independent Host/Paper audit, protected current browser and immutable effective authority ledger. | [Before](evidence/screenshots/baseline/access-1440-dark.png) / [After](evidence/screenshots/candidate/access-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/access-390-light.png) / [After](evidence/screenshots/candidate/access-390-light-viewport.png) |
| Settings | Four deep-linked chapters and eight existing preferences with truthful browser-application feedback. | [Before](evidence/screenshots/baseline/settings-1440-dark.png) / [After](evidence/screenshots/candidate/settings-1440-dark-viewport.png) | [Before](evidence/screenshots/baseline/settings-390-light.png) / [After](evidence/screenshots/candidate/settings-390-light-viewport.png) |

Additional themes use the same naming pattern: `route-1440-light[-viewport].png` and `route-390-dark[-viewport].png`. Tablet captures are 820×1180 light. The viewport/full-page distinction is deliberate; a long page is not claimed to fit on one screen.

## Per-route implementation self-review

This is implementation self-review, not owner/reviewer approval. Layout/readability is based on inspected canonical captures; task/source assertions use the mapped fixture/contract checks. Narrow/keyboard columns use the exact-size and interaction browser results. It does not certify physical devices, assistive technology or every pixel of every state.

| Route | Layout/readability | Task/source truth | Narrow reflow | Keyboard/focus |
| --- | --- | --- | --- | --- |
| Fleet | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |
| Overview | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |
| Performance | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |
| Players | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |
| Console | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |
| Backups | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |
| Access | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |
| Settings | PASS local self-review | PASS local fixture/contracts | PASS exact-size matrix | PASS local browser |

## Preserved boundaries

- The unchanged session.reason → prepare → reviewed execute path owns every mutation. Full server/UUID/device/backup parameters stay visible; target/session/grant changes invalidate review.
- Transport queue acknowledgement and Host accepted job are separate from durable completion. Unknown outcomes cannot be automatically resent.
- Paper game/process data, Host service/cgroup data and node evidence retain separate clocks and scopes. Missing observations remain unknown; 150% cgroup CPU remains valid.
- IndexedDB pairing, safe text, privacy choices, scoped authority, manual Host countdowns and all retention limits remain unchanged.
- No adapter/lib, preference parser, protocol, lockfile, backend, deployment configuration or credentials edits are included.

## How to inspect locally

Use Node 24 and the unchanged lockfile: `npm ci`, then `npm run check` and `npm run build`. The grouped Player tools/Access selectors retain native button semantics and pressed state; arrow keys, Home and End move selection and focus. Console retains the complete roving-tab/tabpanel pattern.

Install the pinned Firefox with `npx playwright install firefox`. Fixture browsers run through `node scripts/qa-local.mjs <script>` with nonlocal requests blocked. `npm run dev` serves localhost only; `?fixture=healthy#Overview` is a prominently labeled development preview, never production authorization.

Reproduce critical regressions with `scripts/nextgen-check.mjs`, `scripts/nextgen-isolation-check.mjs` and `scripts/nextgen-action-parity.mjs`. Reproduce complete visual checks with `scripts/nextgen-matrix.mjs` and `scripts/nextgen-states.mjs`. Build isolation uses `MOZ_DISABLE_CONTENT_SANDBOX=1 node scripts/production-check.mjs`.

Reproduce paired frame measurement using independent base/candidate worktrees and `MOZ_DISABLE_CONTENT_SANDBOX=1 node scripts/browser-profile.mjs --baseline=../baseline --candidate=. --trials=5 --output=artifacts/nextgen/profile-final.json`. The optional `--resume=true` requires identical source/browser identities and resumes only saved completed cases. Run profiling alone, then the sequential 60-second/10-minute endurance script. Performance gates are computed from every final trial; previous interrupted/noisy runs are retained as diagnostics.

## Review and acceptance status

Implementation self-review covers source/state truth, readability, narrow reflow, keyboard/native-dialog behavior and local workflow completion. External reviewer sign-off is NOT_EXECUTED. Physical device, actual 200% zoom, assistive technology and live paired VPS/Host/provider acceptance are separate unexecuted checks. This document does not claim WCAG conformance, 60fps everywhere or live archive integrity.

The final delivery status lists any remaining local gate or access blocker. Do not promote this branch to review-ready status while a critical local gate is failed or blocked. Production requires separate owner authorization.
