# Owner-authorized main integration

On 2026-10-16 the owner instructed: “You may replace the main branch with the implementations you've done here.” This supersedes the earlier prohibition on merging for this implementation. Use a normal PR merge preserving main history; no force push, reset, branch deletion or auto-merge is authorized or needed.

Before this integration edit, the independent checkout was clean at PR head `71369545560cb7c8b7029374ac572daae5227f31`. Fresh remote main remained `4357a66bc674fddce7432cbc27a4fead00ac8234`. GitHub reported PR #91 open, draft and mergeable. No main drift required reconciliation.

The previous no-deploy boundary still applies. Add only `git.deploymentEnabled.main = false` beside the existing exact feature-branch entry in vercel.json before merging. This necessary source-integration guard prevents the main update from triggering automatic Vercel deployment. Every other Vercel field, header and workflow remains unchanged. The only repository workflow's push trigger requires main plus a change to `docs/releases/dashboard-operations-desk-2026.10.15.md`, which this implementation does not touch; it is not manually dispatched. Project API inspection remains unavailable (403); do not claim independent live deployment certification.

The owner was informed before this instruction that the five-pair mixed-source steady Focus timing fails (median baseline 33.34ms, candidate 49.54ms, limit 36.674ms), and CPU-throttled mobile/CLS/native-zoom validation remains blocked. These results are unchanged. Converting the PR out of draft is a mechanical prerequisite for this owner-authorized merge, not a claim that P7 passed.

Application source, Protocol 3, authority/pairing/prepared targets, source truth, manual Host backup behavior and history bounds are unchanged by this integration step. Only the no-deploy guard and integration documentation change. Re-run check/build and the exact configuration/source comparison, then merge the verified PR head using its expected SHA. GitHub PR #91 is the authoritative merge receipt.

No deployment, backend/VPS/relay/credential change or live destructive test is authorized by this integration. Production remains a separate owner decision. Restoring automatic main deployments is also a separate deliberate configuration change; leave the guard in place after this merge.
