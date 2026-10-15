# Remaining risks and acceptance boundaries

| Area | Evidence and practical limit | Release action |
| --- | --- | --- |
| Actual VPS versions | Latest source inspected; installed binaries and configuration not accessed | Record exact runtime versions before acceptance |
| Live pairing, scopes, lifecycle, backups | Contract tests and isolated synthetic browser workflows pass; no disposable live server paired | Execute approved live acceptance in rollout guide |
| Preview origin | Vercel list finds the intended project, but project inspection returns 403 for zpkdxgames-projects; no Vercel CLI credentials available | Verify a Git-generated preview or restore scoped access; do not change relay allowlist without permission |
| High-frequency frame performance | Development Firefox replay and pure path benchmark measured; hardware-dependent tail timings vary; richer page has more DOM | Confirm production build on representative desktop/mobile hardware before cutover |
| Browser coverage | Headless Firefox 157 tested; Chromium runtime absent | Physical mobile, Chromium, Safari and assistive-technology acceptance remain pending |
| Retention/history | Existing 8192/35-minute telemetry and 2500-line console limits preserved | No long-horizon analytics implied |
| Unsupported backend features | Percentiles, file editing, permission tree, remote restore UI and optional skin proxy remain absent or clearly disclosed | Separate contracts/deployment before enabling |
| Source generations | New display epoch guard conservatively clears affected chart view on authority changes | Raw history remains intact; wait for fresh source observations |

No credentials, private endpoint tokens or production command outputs are included in test fixtures or evidence. An automatic approval review halted an initial expanded QA launch over possible third-party skin requests. The executed replacement suite explicitly blocks non-localhost network requests and seeds skins disabled; all data is development fixture data.
