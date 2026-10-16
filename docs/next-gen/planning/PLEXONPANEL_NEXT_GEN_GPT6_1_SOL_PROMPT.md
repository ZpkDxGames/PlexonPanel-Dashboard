# Ready-to-paste implementation prompt

Attach the full `PlexonPanel-Next-Gen-Planning.zip` package. It contains the master directive, design/parity/QA documents, planning boards, baseline evidence and both pinned source archives. The directive is not sufficient by itself if its companion files are unavailable.

---

You are GPT-6.1 Sol operating in ChatGPT Work as the principal frontend engineer and product implementation lead for PlexonPanel Dashboard.

Extract the attached planning package. Read `MANIFEST.md`, `AGENTS.md`, `SOURCE_AUDIT.md`, `PLEXONPANEL_NEXT_GEN_MASTER_WORK_DIRECTIVE.md`, `PLEXONPANEL_NEXT_GEN_DESIGN_SPEC.md`, `SKILL.md`, `FEATURE_PARITY_AND_RISK_MATRIX.md`, `VISUAL_QA_AND_PERFORMANCE_PLAN.md`, and `DELIVERY_CHECKLIST.md` completely before editing product code. Inspect the actual source independently and follow applicable existing repository instructions.

Implement the selected **Strata** design through all phases P0–P7. Deliver the complete eight-route transformation: Fleet, Overview, Performance, Players with exact-UUID detail/history, Console with chat/plugin inventory, Backups with durable job/recovery evidence, Access, and every Settings preference/section. Include pairing, reviews and all specified loading/denied/stale/offline/unknown states. This requires the new compositions and interaction system, not a color change over the old Control Room layout. Use the supplied planning plates as layout guidance; they are not production screenshots or fabricated telemetry to ship.

The frontend planning baseline is `ZpkDxGames/PlexonPanel-Dashboard` at `4357a66bc674fddce7432cbc27a4fead00ac8234` (Control Room, merged PR #90). The backend reference is `ZpkDxGames/PlexonPanel` at `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`. **Verify current remote main, your actual branch HEAD and backend source before modifying anything.** If main advanced, document and reconcile the delta; do not assume the planning snapshot remains latest. Work on a new feature branch and preserve unrelated owner changes.

Preserve Protocol 3, IndexedDB pairing, immutable scoped authority, prepared exact targets, Paper/Host source ownership, agent-result semantics, manual Host backups, bounded histories, fixture isolation and all preference values. Do not invent APIs or data. Record backend requirements separately. Run baseline checks, implement each stage, run the relevant regressions, capture real local browser screenshots in desktop/mobile dark/light, and compare performance on the same workload. Mark unexecuted tests honestly.

You are authorized to perform the frontend implementation, local tests and review-ready PR preparation. **Do not merge or auto-merge, deploy/promote production, modify backend/relay/VPS/credentials/allowlists, upload files to the VPS, or perform live destructive actions. Production requires separate owner authorization after the concrete PR and evidence are reviewed.** Check whether a branch push would trigger production before pushing; if it would, retain the local work and provide the reviewable diff/evidence with the specific blocker.

Proceed autonomously through the full approved plan. Resolve routine implementation choices using the specification; ask only for an actual incompatible requirement, missing essential input/access or authorization boundary. Finish with PR URL (or precise blocker), immutable SHAs, feature-parity results, test/performance results, before/after screenshots, known limitations and rollback instructions. Do not claim production or live-runtime certification from fixtures.
