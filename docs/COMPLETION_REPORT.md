# Completion report

Date: 2026-10-11 UTC

## Shipped

- A separate React, Vite and TypeScript PlexonPanel operations console with its own Git history.
- A new responsive visual system, dark/light themes, lazy workspaces and bundled typography.
- Real protocol-v3 session, relay, telemetry, freshness, grant and bound-action adapters derived from pinned authoritative sources.
- Fleet, Overview, Performance, Players, Console, Chat, Plugins, Backups, Access & audit and Settings workspaces.
- No Configuration/files workspace, by explicit product decision.
- Owner-private Site deployment plus an isolated, clearly labelled Vercel QA preview. Existing production was not modified.

## Capability status

| Area | Status | Evidence or boundary |
| --- | --- | --- |
| Telemetry, freshness and connection state | Verified with contract tests and fixtures | Live relay acceptance remains not executed |
| Player roster, skins and UUID-bound actions | Verified with fixtures and unit tests | Skin proxy is optional; direct providers disclose IP/UUID |
| Console formatting and bounded stream | Verified with golden/adversarial tests and rendered inspection | Live high-volume profiling remains not executed |
| Chat and plugin inventory/reload | Verified with fixtures and rendered inspection | Dispatch requires advertised scopes and a live pairing |
| Backup workflow | Verified/derivable from documented Host contracts | Download, restore and recovery were not executed against a live Host |
| Access, devices and audit | Verified with fixtures and permission gates | Live revoke/audit acceptance remains not executed |
| Configuration/file mutation | Deferred by product decision | No dashboard route is shipped |
| Same-origin skin proxy and richer backup guarantees | Requires backend | Exact contracts are in `BACKEND_REQUIREMENTS.md` |

## Commands and results

- `npm run check`: 35 passed, 0 failed.
- `npm run build`: passed; Motion dependency module-directive warnings were non-fatal.
- `npm run test:perf`: passed; initial-route JavaScript 125,500 gzip bytes, budget 184,320 bytes.
- `npm audit --omit=dev --audit-level=high`: passed; 0 vulnerabilities.
- Unsafe HTML/evaluation source scan: no matches under `src/`.
- `npm run test:browser`: not executed to completion because the Chromium download returned an invalid zero-byte archive.

## Rendered inspection

Inspected Overview, Performance, Players, Console, Chat, Plugins, Backups, Access and Settings in deployed Chromium. Also inspected Overview disconnected and +12-second clock-offset states and Performance in light theme. The later operational routes had zero horizontal overflow at a 1348-pixel client width. No application-origin browser console warning or error was observed.

## Not executed

- Automated Playwright/axe journeys and saved browser screenshots: not executed.
- True mobile viewport, physical phone, Safari, Firefox and screen-reader checks: not executed.
- Live relay CORS/Cloudflare, pairing, telemetry and action dispatch: not executed.
- Backup download hash/save, restore and recovery resolution: not executed.
- LCP, INP, browser long-task and sustained 60-fps console profiling: not executed.

## Known limitations

- `VITE_PLEXON_RELAY_URL` is intentionally unset in the published owner-private candidate; live operation requires the real relay origin.
- The checked-in CSP allows only same-origin connections until the exact HTTPS and WSS relay origins are added.
- The Vercel QA URL is anonymous and temporary unless claimed. It contains only labelled synthetic fixtures and blocks dispatch.
- A fixture snapshot naturally becomes delayed and stale while an inspection session remains open.

## Exact integration next steps

1. Set `VITE_PLEXON_RELAY_URL` to the relay's public HTTPS origin for the permanent candidate deployment.
2. Add the candidate HTTPS origin to the relay allowlist; do not remove the existing production origin.
3. Add only the exact relay HTTPS and WSS origins to the dashboard `connect-src` CSP.
4. Deploy the candidate, generate a new server-local one-time pairing code for that origin, and pair a least-privilege monitoring device first.
5. Run live read-only telemetry acceptance, then scoped action tests, backup preflight and recovery drills.
6. Promote by explicit decision only; use `MIGRATION_ROLLBACK.md` to keep the legacy deployment available throughout rollout.

## Source identity

- Inspected application commit: `8f69e2d1685eaf795ef21880e1e8f8b751f882ca`.
- Reference Dashboard production commit: `d19f94f8e0092bf7ab802be0977959a5c65b7641`.
- Reference Core commit: `09deffc568e36828b4cb56c91f576b7f8524122c`.
- The final documentation-only release commit containing this report is identified by `/build.json` in the final deployment and by the handoff response.
