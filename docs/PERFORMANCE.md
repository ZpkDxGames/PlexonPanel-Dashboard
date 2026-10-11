# Performance report

Measured 2026-10-11 UTC on the production build.

| Check | Result |
| --- | --- |
| Initial route JavaScript | 125,500 gzip bytes |
| Budget | 184,320 gzip bytes |
| Lazy route chunks | Fleet 1.01 KB; Access 1.34 KB; Performance 1.42 KB; Backups 1.97 KB; Settings 2.10 KB; Overview 2.24 KB; Players 2.56 KB; Console 4.53 KB (Vite-reported gzip) |
| Reducer soak | Passed virtual 30-minute telemetry/console/roster load; bounds retained |
| Browser LCP / INP / long tasks | Not executed; local Playwright browser runtime unavailable |
| Console scroll 60 fps | Not executed with a profiler |

The console renders a fixed-height overscanned window in no-wrap mode. Telemetry history, console lines, roster, worlds and passive feeds retain explicit caps. Route workspaces load on demand. The automated measurement source is `artifacts/performance.json`.
