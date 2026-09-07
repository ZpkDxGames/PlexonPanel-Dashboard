# Validation and release acceptance

Status: Dashboard 2.2.0 / agent 3.0.0 review candidate. Production deployment and stable Java publication remain blocked on real live gates. Source baselines were plugin `6317bfbba1990cd8a96852b03f8097a524f745db` and dashboard `98166f7d9b3851a1c96d160c2b5eefc3b231c58f`.

## Automated evidence

The implementation branch passes ESLint, application TypeScript, relay TypeScript, a Next 16.3.1 production build, **29 relay tests**, and **34 dashboard/client/UI tests** on the development workspace. Added coverage includes Paper-only/strict presence routing, scope/capability filtering, private/no-storage history results, snapshot rate limits, atomic multipart roster reconciliation, duplicate/session isolation, cache exclusion, older-agent and policy/scope states, and read-only offline details.

`npm run relay:smoke` uses actual local workerd with temporary state and ephemeral keys. It validates protocol-3 authentication, pairing/session routing, bounded telemetry, authorization denial and live revocation, but it is still a simulation—not a real Paper server or deployed Cloudflare/Vercel acceptance result.

## Live gates still pending

| Gate | Required evidence | Blocker |
| --- | --- | --- |
| Paper presence lifecycle | Real Paper 26.2/Java 25 join, quit, kick, rapid reconnect, reload, restart, disabled history, closed-dashboard history and multi-page query. | Disposable server, controlled players and operator setup. |
| Crash/orphan recovery | Forced Paper termination followed by honest `UNKNOWN_DISCONNECT`, no fabricated exact end/duration, and no duplicate closure. | Disposable failure environment. |
| Realtime reconciliation | One-tick-plus-network delta target, relay/dashboard outage and reconnect, fresh complete snapshot, manual refresh/coalescing/rate limit, no stale online roster. | Paired Paper and relay environment. |
| Permissions/privacy | Observer/current roster, qualifying new grants/history, old grant unchanged, Owner denied while local history is off; journal/browser/relay/log/audit inspection. | Controlled role devices and storage inspection. |
| Mixed protocol-3 versions | New dashboard with 2.0 Paper, 3.0 Paper with older UI/relay, and all-current; preserve UUID/fingerprint/grants/revocation. | Retained reviewed artifacts and disposable deployment. |
| Responsive/browser QA | Authenticated Players tabs, filters, tables and drawers at desktop, tablet and phone widths with keyboard/screen-reader checks. | Live browser/Paper data environment. |
| Cloudflare + Vercel | Existing signing identity/namespace/pins, origins/CSP, private results, hibernation, reconnect and server isolation. | Approved deployment accounts/environment. |
| 30-minute representative load | Baseline versus 3.0 event latency, snapshot duration, TPS/MSPT, heap, queue depth, journal/index size, saturation and reconnect behavior. | Representative loaded Paper server. |

Record exact paired commits, artifact hashes, Paper/Java/OS/browser versions, configuration differences, timestamps and sanitized outcomes. Never commit credentials, private player records, raw logs, production configuration or test-account secrets.

## Release rule

Review and merge the paired plugin/dashboard revisions only after their final CI is green and the compatibility relationship is explicit. Preserve protocol 3, relay signing identity, Durable Object data, Paper identity and existing grants. Deploy deliberately during a coordinated maintenance window. A green unit/build/smoke run must never be described as real paired-server acceptance.
