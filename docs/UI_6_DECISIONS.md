# 6.0.0 maintainer decisions

Approved by the maintainer on 2026-10-08. This document overrides `PLEXONPANEL_6.0.0_REVAMP.md` wherever they conflict. The current session covers M0 and M1 only; approval is still required before M2.

1. **Service-state conflict: APPROVED option 1.** Missing Host service state always stays unknown; all lifecycle callers use Host state only; revise the contradictory dashboard-2-1 assertion and add a mounted palette gating regression. Implement this in **M3, not now**. Continue M0/M1 with current code unchanged.
2. **Overview** keeps its existing six tiles (TPS, MSPT, online players, JVM heap, service CPU, service RAM) in a designed hierarchy. **Performance keeps all nine charts.** Host CPU and Paper process CPU stay separately labeled in Performance.
3. **Backups:** one progress display keyed to the 15 real phase keys (QUEUED through COMPLETED) plus DEGRADED, FAILED and RECOVERY_REQUIRED. Never invent simultaneous compression/upload counters; show **“not supplied”** when absent.
4. **Command palette navigates only.** Restart is reachable through Server with its bound confirmation.
5. **Preferences:** keep the stored accent enums (`monochrome/cyan/violet/emerald/amber`) and the existing storage key. Any new accent names or OS-following default apply only when no saved preference exists. Parsing is additive and migration-tested.
6. **Chat:** keep the existing bounded local cache (max 100) and add a visible **“Clear local chat cache”** control in Settings > data & privacy.
7. **Access copy** must reflect that Files and Backups are active. Remove the **“Advanced / Future”** wording.
8. **`lib/cpu-load.js` and its tests:** approved for removal in **M8**.
9. **Configuration save confirmation** goes through the existing bound action path only; keep the existing diff, hash-conflict preservation and dirty-leave protection.
10. **Push:** the maintainer authorizes pushing branch **`release/6.0.0`** (docs and later work) to **origin**. Never push to main; never create tags without telling the maintainer.

## Tasks, in order

### A. Screenshot environment

Fix the screenshot environment. Use Playwright's headless-shell Chromium with software rendering (`--disable-gpu`, `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`), install missing system dependencies if possible, and verify with **one page load before the full matrix**. If it truly cannot run in this environment, stop and tell the maintainer exactly what to run on their machine.

### B. Finish M0

Capture the full matrix: all workspaces plus pairing/legacy route, light/dark, 390/768/1280/1920. Do not overwrite accepted 5.0 evidence. Run axe on each page and complete the state matrices, per-control authorization audit and test-gap list from the brief. Update `UI_6_BASELINE.md`; replace “interrupted checkpoint” only when the gates truly pass.

### C. M1

Produce `UI_6_DESIGN.md` with tokens, the typeface decision, wireframes, Tick Pulse specification and anti-template self-review.

Then stop and report baseline findings, design direction with the riskiest choices, and any conflicts. Do not start M2 without approval. Report unexecuted gates as **not executed**.
