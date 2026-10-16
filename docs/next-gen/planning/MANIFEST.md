# PlexonPanel Next Generation — start here

Planning package v1.0 · 2026-10-16 · selected visual concept: **Strata**.

This is a self-contained design and engineering handoff for a separate implementation chat. No frontend implementation or production change is included. The current source is the merged **Control Room**; Operations Desk is historical. The eight required documents are substantive project specifications, not generated copies of the original brief.

## File manifest

| File / folder | Purpose | Read / use |
| --- | --- | --- |
| `AGENTS.md` | Agent contract, immutable references, protected areas, file ownership, stop/go rules | Read first with existing repository/ancestor instructions; reconcile before placing at repo root |
| `SKILL.md` | Portable PlexonPanel visual-systems playbook, practical patterns and anti-patterns | Read as a project document; do not install/publish as a personal skill |
| `PLEXONPANEL_NEXT_GEN_DESIGN_SPEC.md` | Three concepts, selected Strata system, exact tokens/layouts/components, all eight routes, shared states, pairing/reviews/motion | Authority for visual and interaction decisions |
| `PLEXONPANEL_NEXT_GEN_MASTER_WORK_DIRECTIVE.md` | P0–P7 execution stages, exact source ownership, regression gates, rollback and PR requirements | Execute in order |
| `PLEXONPANEL_NEXT_GEN_GPT6_1_SOL_PROMPT.md` | Ready-to-paste implementation-chat prompt | Paste its prompt section and attach this complete package, which includes the directive |
| `FEATURE_PARITY_AND_RISK_MATRIX.md` | Feature-by-feature current map, canonical action/scope/agent table, deferred features and risks | Track every row in implementation evidence |
| `VISUAL_QA_AND_PERFORMANCE_PLAN.md` | Screenshot/state/preferences matrix, 32 critical scenarios, accessibility and quantitative performance budgets | Required verification contract |
| `DELIVERY_CHECKLIST.md` | Completed planning versus pending implementation, review, merge and production gates | Track completion without confusing evidence levels |
| `SOURCE_AUDIT.md` | Verified architecture/provenance, current versus historical distinctions, 65 source anchors and actual local checks | Read before implementation source audit |
| `design/README.md` and 42 PNGs | Three concept comparison, selected overview board, eight-route desktop/mobile dark/light wireframes and tablet/light wireframes | Planning composition guidance; not application screenshots |
| `evidence/baseline/` | 32 independently captured Control Room fixture PNGs and original results JSON | Before-state comparison; synthetic fixture data only |
| `evidence/baseline-contact.png` | Contact sheet of captured baseline routes | Orientation; full-resolution images govern visual inspection |
| `evidence/performance.json`, `baseline-build.json`, `verification-record.json` | Canonical local gzip results, local build identity and executed/not-executed checks | Source/fixture evidence, not runtime certification |
| `evidence/source-identity.json`, `source-anchors.json` | Immutable Git identities and commit-pinned links | Auditability and offline source navigation |
| `evidence/source-archive-verification.json`, `dashboard-tree.json`, `backend-tree.json` | Every tracked blob checked against archived bytes; per-file hashes and modes | Verify archives are complete, unchanged source |
| `evidence/token-contrast.json` | 98 neutral-surface text/control/accent contrast calculations, all passing their stated thresholds | Token check only; rendered tints, controls and states still require QA |
| `source/PlexonPanel-Dashboard-4357a66.zip` | Complete frontend Git archive: 143 tracked blobs, 1,507,433 blob bytes | Immutable planning reference; not a current checkout |
| `source/PlexonPanel-209f8b4.zip` | Complete backend Git archive: 329 tracked blobs, 1,515,457 blob bytes | Read-only contract reference; no backend edits authorized |
| `source/brief/` | Unmodified supplied INSTRUCTIONS.md, SOURCE_SNAPSHOT.md and README_FIRST.md | Authoritative brief plus clearly historical previous-handoff provenance |
| `FILE_MANIFEST.json`, `SHA256SUMS` | Machine-readable inventory and integrity checks | Verify after extraction; manifest excludes itself/checksum to avoid recursion |

## Source identity

Frontend planning SHA: `4357a66bc674fddce7432cbc27a4fead00ac8234`.

Backend planning SHA: `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`.

**Sol must verify the current local branch HEAD and current remote main before editing.** Both matched the pins during planning; this is not a promise about a later chat. Use a real Git checkout for implementation, reconcile newer source and existing owner changes, then create a new feature branch. Archives have no `.git` history and should never replace a newer repository wholesale.

Archive SHA-256 values:

- Frontend: `02b2e303a29fc5d9217a91c6ad0a8cad85a809919844d0a9eddb72b4c598e8c4`
- Backend: `8b9a6ab9975921bc15e3c9da3fc412dec4eb62cebd623b6a556d1aa183d871ad`

## Recommended reading and execution order

Read MANIFEST → AGENTS + original INSTRUCTIONS + actual repository instructions → SOURCE_AUDIT → MASTER_WORK_DIRECTIVE → DESIGN_SPEC + SKILL → FEATURE_PARITY_AND_RISK_MATRIX → VISUAL_QA_AND_PERFORMANCE_PLAN → DELIVERY_CHECKLIST. Inspect the planning plates alongside the baseline captures. The Sol prompt starts the work; it does not replace these documents.

| Phase | Concrete outcome | Main ownership |
| --- | --- | --- |
| P0 | Reconciled current source, baseline evidence and fresh branch | Git/source audit, test scripts, evidence scaffold |
| P1 | Strata tokens, typography, icons, state primitives and modular CSS ownership | Shared presentation foundations |
| P2 | Horizontal shell, target selector, narrow navigation, pairing and shared review frame | Shell/entry/review presentation |
| P3 | Fleet ledger, first-viewport Overview, focused/compare Performance | Monitoring routes and charts |
| P4 | Exact-UUID profiles, terminal, chat and plugin inventory | Players/Console and supporting components |
| P5 | Recovery-first backups, partial read evidence and immutable authority ledger | Backups/Access and action-result presentation |
| P6 | All Settings chapters/preferences and cross-route interaction polish | Preferences, time formatting, responsive refinement |
| P7 | Tests, actual browser screenshots, paired performance results, full parity and review-ready PR | QA/evidence/PR and rollback documentation |

All eight routes are equal release gates. P3/P4/P5/P6 are sequencing, not relative importance. Shared-file ownership moves sequentially; this package does not require parallel agents.

## Architecture and selected visual direction

Retain React/Vite, the eight lazy hash routes, bounded external stores, project SVG charts and Protocol 3. Strata changes the presentation: basalt/limestone surfaces, a full-width route frame, connected readings and ledgers, explicit Paper/JVM/service/node layers, purposeful Minecraft block geometry, exact-identity player tools, a single terminal work surface and recovery evidence before backup inventory. Both themes and narrow screens are designed deliberately.

`session.reason → prepare → ActionReview → execute` remains the authority path. IndexedDB pairing and action targets stay intact. The browser displays Host work; it does not orchestrate the cold-backup service or equate accepted jobs with completed backups.

## Evidence and limitations

Independently executed in planning: 61 frontend tests, TypeScript/build, initial JS 89,808 gzip bytes, and 32 local fixture screenshots with zero reported axe/document-overflow/page-error failures. Source archives were compared byte-for-byte with every tracked Git blob. Token contrast passed 98 specified pairs. No candidate Strata app exists yet.

Known implementation risks: migrating 5,114 lines of CSS without override conflicts; eight-track chart cost; terminal row geometry under text-size/zoom changes; exact identity/focus during source changes; partial preflight and unknown action outcomes; source drift. Physical-device, assistive-technology, full preference/zoom, fresh replay and live-runtime acceptance remain separate checks. Backend source was read; backend builds/tests and the complete deployed relay were not independently exercised.

The later task must deliver a **review-ready PR**. No merge, auto-merge, production deployment/promotion, VPS upload, backend/relay change, credential action or live destructive test is authorized by this package. Obtain separate owner authorization for production against a concrete reviewed result.

To verify extracted files on a system with GNU coreutils, run `sha256sum -c SHA256SUMS` from this folder. The checksums certify packaged bytes, not software correctness or deployed state.
