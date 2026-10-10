# Dashboard 6.0.0 production authorization

The operator requested production deployment on 2026-10-10 after the unexecuted live checks were disclosed. This is Dashboard-only publication, with runtime certification explicitly `NOT_EXECUTED`.

Commit the gate and HOLD receipt first. After that exact source commit passes CI (check, build, browser, axe and audit), activate it in a separate commit changing only `docs/dashboard-production-6.0.0.json`: READY, its exact parent as accepted source, the passing CI run ID, PASS automated evidence and operator approval. Keep every manual check `NOT_EXECUTED`.

Only Vercel production on `main` can use this receipt. Changed source, dirty worktrees, missing ancestry, wrong scope and incomplete evidence remain held. A Vercel formatting rewrite of otherwise identical `vercel.json` is accepted. Worker, relay, Core, Host and Paper publication are not authorized.

This receipt never labels unexecuted live checks as passed. Existing runtime software remains at its accepted 5.0.0 source; the updated application, UI and protocol are unchanged by this production gate.
