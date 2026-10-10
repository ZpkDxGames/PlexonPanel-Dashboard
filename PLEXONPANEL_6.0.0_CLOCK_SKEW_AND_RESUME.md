# PlexonPanel Dashboard 6.0.0 — Clock-skew handling, diagnostics, and resume

**Audience:** the next agentic AI working on `release/6.0.0`.
**Read first:** `PLEXONPANEL_6.0.0_UIUX_FAST_TRACK.md` (process, invariants, UX system, batches) and `docs/ui6-regression/REPORT.md`. This file adds a short stability pass, then resumes the fast-track at Batch 3. If this file and the fast-track conflict, **this file wins**.

---

## 1. What is already known

An investigation compared the 5.0.0 anchor (`86b6a0cefb2c5e420c9c862a7897705e1ea59146`) with release head `309baaf0578cb48407a6c03f42ee5eb7a7bbfdb5`. Findings:

1. **Not a 6.0 regression.** With Paper captures stamped 6, 30 and 120 seconds ahead of the browser, the four Paper tiles (TPS, MSPT, online players, JVM heap) show a dash and "clock mismatch", the connection banner says "Minecraft telemetry unavailable", and the chart still says "Last sample 0.0s ago", while Host service CPU/RAM stay visible. This is identical at 5.0.0 and at 6.0. `lib/telemetry-freshness.ts` is byte-identical at both commits and rejects any capture more than 5 seconds ahead of the browser clock.
2. **Inconsistent presentation (present since 5.0.0).** Tiles, banner and chart judge the same sample differently; the chart's age formatter clamps negative ages to zero, so it reports a fresh sample while the tiles and banner reject it.
3. **A 6.0-only bug.** A memoized tile keeps the previous browser-receipt disclosure instead of the latest one. The age clock itself still advances.
4. **Backups show no regression.** A degraded Host job (`DEGRADED`, `REMOTE_VERIFY_FAILED`, local verified, remote not current, retryable) renders identically in 5.0.0 and 6.0, Retry Upload stays enabled, and the manual-backup launch follows preflight. The real-server failure is a Host-side remote-verification result (rclone/Google Drive), not a dashboard defect.
5. **Not established:** the real clocks of the VPS and the maintainer's computer, the real packets, and the full shell header agreement. Never claim a root cause in the real environment; report what is evidenced.

Current refs in the bundle: `refs/heads/release/6.0.0` (head `5820da5faea58372d0dede3f64efbd2abe9d1d8c`) and `refs/stash` (unfinished Batch 3, paused and excluded from the release tree). The probe tests live in `docs/ui6-regression/` outside the ordinary test glob.

---

## 2. Ground rules (unchanged from the fast-track, restated)

- Branch `release/6.0.0`. No `main`, no tags, no deploys. **No `git push`** (no credential in this environment): commit per task, then write a `git bundle` outside the repo, run `git bundle verify`, and report its path, SHA-256 and head SHA.
- No new runtime dependencies. **No protocol, relay, Core, Host or Paper-plugin changes.** If diagnostics show the Paper timestamps themselves are wrong, report it to the maintainer; do not work around it in the relay or protocol.
- Keep every invariant from the fast-track Section 2. In particular: capture time and receipt time stay **distinct**; unknown never becomes zero; Host CPU and Paper process CPU stay separate; no interpolation; no optimistic success.
- Report anything you did not run as "not executed".
- Keep reports short.

---

## 3. Task A — One freshness classification, with a visible "clock skew" state

**Goal:** a drifting clock must not make a live server look dead, and the tiles, banner, charts and header must never disagree about the same sample.

### 3.1 Single source of truth
Add one function in `lib/telemetry-freshness.ts`, for example `classifyTelemetry({ capturedAt, receivedAt, connected, now })`, returning a kind and a label. **Every surface must call it:** Overview tiles, the compact Tick Pulse in the header, the full Pulse, chart badges and "last sample" text, the connection decision/banner, and Pulse summary labels. Remove any surface that computes freshness on its own.

Kinds (existing thresholds unchanged): `disconnected`, `waiting`, `live` (≤ 10 s), `delayed` (> 10 s), `stale` (> 30 s), and the new **`skew`**.

### 3.2 Skew rule
- `skewAheadMs = capturedAt − receivedAt`, using the **latest packet's browser receipt time** (the existing `useTelemetryNow(receivedAt)` guarantee stays: a packet is never judged against a clock older than its receipt).
- `skew` applies when `skewAheadMs > 5_000` (same threshold as today; do not change it).
- In `skew`:
  - **Show the latest value**, do not blank it. The value is a real received sample.
  - Never label it `live`. The caption reads like `clock skew +12 s · received 1 s ago`.
  - **Age for delayed/stale is judged by browser receipt age** (`now − receivedAt`) using the same 10 s / 30 s thresholds. If receipts stop arriving, the tile still goes `delayed` then `stale`, and then shows the existing stale presentation with the skew note.
  - Charts keep positioning samples by `capturedAt` (unchanged). Replace the chart's "Stale" badge in this state with **"Clock skew +N s"**, and state in the chart footer that sample times come from the Paper clock. The chart must never print "Last sample 0.0s ago" for a skewed sample: show the receipt age instead, with the skew note.
  - The Overview banner changes from "Minecraft telemetry unavailable" to a warning: *"Paper's clock is about N s ahead of this browser. Values are the latest received samples. Check time synchronization on the server and on this computer."* Use "unavailable" only when there really is no usable sample (disconnected, waiting, or receipts stopped).
- Behind-clock case (capture much older than receipt): **do not add new logic.** Existing stale behavior stays. Only show the offset (sign and size) in diagnostics (Task B), because delayed delivery and a slow clock cannot be told apart from a single packet.
- Unknown stays unknown; a real zero stays a real zero.

### 3.3 Tests (must fail before, pass after)
Promote the regression probes into the **ordinary test suite**, not an excluded folder:
1. Lib: skew at +6, +30, +120 s → `skew` kind; +4 s → normal; receipt age drives delayed/stale inside skew.
2. Mounted Overview at +6/+30/+120 s: all four Paper tiles show values with the skew caption; banner is the skew warning; chart badge says clock skew; **no surface says "live" or "0.0s ago"**; Host tiles unaffected.
3. Tiles, header Pulse, chart and banner agree for the same capture (parametrized).
4. Receipts stop in skew → tiles go delayed then stale, still marked skew.
5. New Paper session after a restart: first captures, missing uptime shows "Not supplied", no false skew when clocks agree.
6. Shared 1 s age clock still advances at saved Display rates 0/500/2000 ms without a parent re-render (existing probe).
7. Keep the anchor-comparison probe script available but out of the ordinary glob; do not delete it.

---

## 4. Task B — Diagnostics that explain a clock problem

Extend the existing **"Source details and safe diagnostics"** disclosure (Overview) with a small, plain-language **Clocks** block, built only from data the browser already has:

- Browser time now.
- Paper: latest `capturedAt`, browser `receivedAt`, and **offset** (`capturedAt − receivedAt`, signed, in seconds).
- Host: latest `capturedAt`, `receivedAt` and offset **if the Host packets carry a capture time**; otherwise "Not supplied".
- **Paper − Host capture offset** (signed seconds), when both exist.
- A one-line interpretation, derived by simple rules, never speculative:
  - Paper and Host offsets are both large and similar → "Server clock and this browser disagree by about N s. Check time sync on the server and on this computer."
  - Only Paper's offset is large (Paper ≠ Host) → "Paper's timestamps disagree with the Host's. This may be a Paper-side timestamp issue."
  - Offsets small → "Clocks agree."
  - Anything missing → "Not enough data."

Rules: normal-case labels, tabular numbers, no tokens or sensitive content, copyable block ("Copy clock details") for support. Only data already available; do not add telemetry or storage. This block is what lets the maintainer tell a PC clock problem from a server clock problem without reading code.

---

## 5. Task C — Fix the stale receipt disclosure

A memoized Overview tile keeps showing the previous browser-receipt time. Find why (a memo dependency list that omits the receipt time is the likely cause), fix it, and cover it with a mounted test that sends two consecutive captures and checks the disclosure shows the newer receipt. Check the compact Pulse and other memoized surfaces for the same omission.

---

## 6. Task D — Backups: no regression, one UX improvement

The investigation found the backup states render correctly. Do **not** change gating, labels or logic, and **do not rename** "Review & start backup" or "Fully Backup Now" in this task.

In the Batch 3 Backups restyle (Section 7), improve presentation of a degraded job so the operator knows what to do next:
- A clear status panel: "Local backup verified. Off-site copy not current." with Minecraft availability restored shown separately, and **Retry Upload** as the primary action.
- Plain next-step text for `REMOTE_VERIFY_FAILED`: "The Host could not verify the remote copy. Check the Google Drive connection on the server, then retry." Keep the raw error code visible but secondary.
- Replace the raw key–value table with a grouped, scannable layout: job (ID, started, phase, result), local verification, remote verification (distinct from the provider connectivity test), progress, error. "Not supplied" where the Host did not report a value.
- Add a mounted test replaying that exact degraded job snapshot and asserting the rendered statuses, the Retry Upload gating and that the launch button follows preflight.

---

## 7. Resume the fast-track

After Tasks A–D are green and committed:

1. **Recover the paused work:** inspect `refs/stash` (unfinished Batch 3). Apply it onto the new head, resolve conflicts, and continue Batch 3 (Server, Backups, Configuration) per the fast-track Sections 4–5, including Task D's Backups improvements. If the stash does not apply cleanly or looks unreliable, restart Batch 3 from the head and keep the stash for reference. Do not drop it.
2. Continue **Batch 4** (Access, Audit, Settings) and **Batch 5** (polish and wrap-up), per the fast-track.
3. Include the mounted tests for every state-changing action required earlier: chat send, plugin reload, console command dispatch, player actions, server lifecycle, backup start and Retry Upload, scheduler save, configuration save, access revocation — each proving (a) the confirmation shows the bound target, (b) nothing is dispatched before confirming, (c) the result comes from the signed response with no optimistic success. Backups also: preflight blocks the launch, reload reconstructs the active job, progress for a different job ID is ignored. Configuration: dirty-leave protection and hash-conflict preservation. Extend the existing signed two-room harness; no new infrastructure.
4. No review stops; stop only for the fast-track stop conditions.

---

## 8. Verification

- After Tasks A–D: `npm run lint && npm run typecheck && npm test`, then `npm run check` and `npm run test:browser`. Screenshots (390 and 1280 px, light and dark) of the Overview in these states: healthy, skew +12 s (values visible, banner, chart badge, diagnostics open), and receipts stopped in skew. One axe scan each.
- At the end of the whole run: clean install, `npm run build`, `npm run check`, `npm run test:browser`.
- Real-server verification and a phone check are the maintainer's: report them as "not executed."

---

## 9. Final report (≤ 30 lines)

1. What changed (one paragraph) and head commit.
2. Gate table: check, build, browser verifier, axe → passed / failed / not executed.
3. Where the freshness classification now lives and which surfaces call it.
4. What the diagnostics block shows and how to read it.
5. Deviations from this file and reasons.
6. Known rough edges (for example behind-clock case left as diagnostics only).
7. Bundle path, SHA-256, head SHA.
8. **Manual checks for the maintainer:** compare the PC clock and the VPS clock; open the Clocks block with the real server connected; verify the rclone/Google Drive connection on the VPS and press Retry Upload once; run one full backup with a browser reload during it; confirm the console works with Paper stopped.

---

## Appendix — Interpretation cheat sheet for the maintainer

| What the Clocks block shows | Likely meaning | What to do |
|---|---|---|
| Paper and Host offsets both about +10 s or more | Server clock is ahead of this computer (or this computer is behind) | Sync time on the PC (`w32tm /resync`) and check `timedatectl` on the VPS |
| Paper offset large, Host offset small | Paper plugin stamps samples with a different clock or format | Check recent Paper plugin or Core changes; report to the developer |
| Offsets near zero, tiles still blank | Telemetry not arriving or disconnected | Check Paper connectivity and the relay |
| Offsets large and negative (capture behind receipt) | PC clock ahead, or delayed delivery | Compare clocks; check relay delivery lag |
