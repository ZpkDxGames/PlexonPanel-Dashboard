# Strata implementation baseline

Verified 2026-10-16 before product edits. Frontend local main and remote main: `4357a66bc674fddce7432cbc27a4fead00ac8234`. Backend remote main: `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`. Independent clean clone; feature branch `design/strata-next-gen-20261016`. Older checkout `fix/final-stabilization-resumed` at e761412 was preserved, including its missing alternate object reference.

Node 24.19.0 / npm 11.9.0, locked dependencies unchanged. Baseline check: 61 passed, zero failures. Build PASS. Initial JS gzip 89,808 B. Full source and fixture checks are recorded in VALIDATION.md and evidence.

GitHub workflow only publishes a specific release document on main or explicit dispatch; no feature-branch release workflow. No deployment command is authorized. A Vercel success check also exists on main. Read-only project access returned 403, initially blocking publication. The owner subsequently approved the exact branch-only no-deploy guard; see PUBLICATION_BLOCKER.md for the exception and DELIVERY_STATUS.md for the publication receipt. Remote frontend/backend main were checked again before applying the guard and still matched the audited bases.
