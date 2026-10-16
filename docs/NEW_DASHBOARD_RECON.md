# Reference Control Room — reconnaissance

Implementation base: `cea185cca07d9892967215baed097bedbe0e77ca`, freshly fetched from GitHub main. Core main was independently rechecked at `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`. Baseline GitHub Vercel commit status was successful. Installed VPS/Paper/Host versions were not inspected.

Read the package START_HERE, AGENTS, complete SKILL, new reference brief, current-state record and all four PNGs. Inspected application entry/router, all eight routes, components, preferences, presentation projections, session prepare/valid/execute/query paths, grants, reducer bounds, transport ownership, tests, deployment configuration and Core protocol/fleet/Host/backup/release-gate sources. The latest visual brief supersedes Operations Desk's older art direction.

This remains React 19.3.0, Vite 8.3.4, TypeScript 7.0.2 and Node 24.x. There is no lint script. The new working branch is `design/reference-control-room`.

## Trust lock

- Entry: initialized credential storage plus 2.8-second minimum splash; credentials remain in IndexedDB.
- One selected writable session, at most 16 passive feeds; source epochs and server/revision remounts remain intact.
- Signed Protocol 3, `/v1`, immutable scopes, exact Host/Paper association and action targets remain authoritative.
- Mutations use reason → prepare → explicit review → execute. No retry of unknown outcomes.
- Paper runtime, Paper JVM, Host node and Minecraft cgroup remain distinct; fresh known capacity is required for a resource bar.
- Backups retain the five fail-closed readiness booleans, durable phases, job-matched progress and reviewed archive operations.
- Raw telemetry retention, console/roster/world bounds and original extrema/gap reduction remain unchanged.

No source bottleneck justifies a backend change. The 5.0 source gates still do not certify deployed runtime, migration or backups. NO SERVER-SIDE CHANGE NEEDED.

The package verifier was run after Git commands had refreshed `.git/index` and reported that index-byte mismatch. The checkout was clean and exactly matched the recorded commit before source edits. Git's index metadata is not application source. A separate byte-for-byte ZIP verification subsequently checked all 493 manifest entries with zero mismatches.
