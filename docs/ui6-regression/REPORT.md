# Paper freshness regression investigation

Compared 5.0.0 anchor `86b6a0cefb2c5e420c9c862a7897705e1ea59146` with accepted release HEAD `309baaf0578cb48407a6c03f42ee5eb7a7bbfdb5`. No production source, design, protocol, dependencies, clock threshold or authorization rule changed. Unfinished Batch 3 is preserved in `refs/stash` and excluded from the release tree.

The full reported skew symptom already reproduces at the 5.0.0 anchor. At +6, +30 and +120 seconds, the four Paper tiles show a dash and clock mismatch, the connection decision says Minecraft telemetry unavailable, the chart says Last sample 0.0s ago, and Host service CPU remains 150%. The freshness module is byte-identical at both commits. It rejects captures more than five seconds ahead; the chart's age formatter clamps negative age to zero. This is consistent with a capture/browser clock discrepancy, not a newly introduced 6.0 freshness policy. Real-server clocks and actual captured packets were not inspected.

Your explicit anchor stop applies. `git bisect`: **not executed**; a first bad commit cannot be established within the specified interval because its proposed good endpoint already reproduces the failure. No production fix was made.

| Probe | 5.0.0 | Accepted 6.0 branch |
|---|---|---|
| Lib future-capture rejection, +6/+30/+120 s | Passed | Passed |
| Mounted tiles/chart freshness agreement, three skews | Failed in all three | Failed in all three |
| New Paper session, first captures, missing uptime | Passed | Passed |
| Shared 1 s age clock at saved Display rates 0/500/2000 ms, no parent re-render | Passed | Passed |
| Memoized tile's latest browser receipt disclosure | not executed: disclosure absent | Failed: previous receipt retained |
| Degraded Host job, preflight pass/fail replay | Passed | Passed |

The receipt disclosure failure is separate from the reproduced clock-mismatch symptom: the age clock still advances and expires tiles. It remains unfixed under the stop instruction. Tests mount Overview and the shared compact TickPulse component; the full shell header and actual Dashboard transport throttling are **not executed**. Saved display-rate preferences are exercised; a queued transport delivery is not simulated. Header Pulse did not exist at the 5.0.0 anchor.

Backups replay uses the existing action binding/completion entry points with a deterministic Host response snapshot, without dispatching mutations. It is not a cryptographic signed-agent end-to-end test. Both versions render DEGRADED, REMOTE_VERIFY_FAILED, local Verified and remote Not current — retryable. With successful fresh preflight, stable active service and ready command channel, the manual full-backup launch is enabled. Failed source preflight disables that launch. Retry Upload remains visible and enabled in both cases; it retries the retained archive without another shutdown. No gating or rendered-state difference was observed. Both versions retain the pre-existing launch label Review & start backup under the Fully Backup Now panel.

Run the intentionally failing investigation probes directly after `node scripts/transpile-tests.mjs`:
`REGRESSION_VERSION=6.0 REGRESSION_OUTPUT=docs/ui6-regression/head-results.json node --test docs/ui6-regression/paper-regression.test.mjs`
For the anchor, transpile its worktree and supply `REGRESSION_ROOT=/absolute/anchor/worktree`; the same probe file and dependency installation are used. The explicit probes live outside the ordinary release test glob so known, unfixed baseline failures remain visible rather than being silently marked passed or skipped.

Final probe counts: HEAD 7 passed / 4 failed; anchor 7 passed / 3 failed / 1 not executed. Raw output and structured evidence accompany this report. `npm run check`, `npm run test:browser`, clean build/install, full signed-fixture throttled transport, full shell-header agreement, live-server verification, real-device check and git push: **not executed** after the explicit baseline stop. Bundle creation, verification, SHA-256 and head SHA are recorded in the delivered receipt.
