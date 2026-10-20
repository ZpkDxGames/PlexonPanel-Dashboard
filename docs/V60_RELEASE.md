# PlexonPanel v6 — Durability workbench and preservation receipt

This release adds a local-first durability workbench and shared maintenance status while preserving the v5.3 Mission Deck. The exact symbol and stage mappings are in [V60_BINDINGS.md](V60_BINDINGS.md).

| Contract | Implementation |
| --- | --- |
| Independent preflight | Recovery, source, storage and provider remain separate. A provider failure does not hide local readiness. UI gates preserve job → recovery → source → storage → required-provider priority. |
| Destination selection | AUTO follows the Host’s opt-in fallback setting; explicit Drive requires its provider; Local VPS only is available on the new Host. Older Hosts retain the legacy single-destination path. |
| Recovery | Backup recovery verifies service/readiness in one click. Interrupted restores require an additional world-review dialog and an explicit boolean acknowledgement. Original errors and restore journals remain available on the Host. |
| Schedule | Existing schema-2 settings and exclusions are preserved. Custom segments/listboxes replace native checkbox, number, time and select controls. Custom persisted times/retention values remain selectable. Saving retains the existing exact-settings review. |
| Archive ledger | Verified local, Drive/local, Drive-only and unverified locations are distinguished. Full SHA-256 is copied without expanding the row. Verify, promote, restore and delete retain their existing scopes; restore retains the Host-issued token and exact server-name review. |
| Header | One shared status/preflight provider, a monotonic one-second countdown, and a fixed 56-pixel header. Quick Backup always sends AUTO/300 seconds and routes blocked clicks to Backups. |
| Player inspection | Native keyboard-operable roster/event controls persist a UUID or case-insensitive name key. Players resolves and scrolls the matching row; unknown names produce no application error. |
| Readout | Short Chunks/Entities labels and wrapping between intact groups remove right-edge clipping at 1280, 1366, 1545 and 1920 pixels. The existing analyzer already scrolls internally; the page remains viewport-sized. |
| Preservation | No UI purge. The other seven route structures and charts remain intact. The 27 frozen core hashes are checked against both the local and tracked baseline contracts. |

## Verification commands

```
bash scripts/verify-purge.sh
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:production
npm run verify:structure
node scripts/polish-checks.mjs
```

The structural suite retains all original 25 invariant groups and adds backupsNoNativeControls, backupsNoHero, readoutBarNoClip, headerHeight56WithCountdown and gateReasonInlineZero. Its normal matrix remains all eight routes × four viewport sizes × two themes (64 configurations). Added checks cover four Performance widths, all routes with countdowns (including control bounds), recovery clearing, explicit restore acknowledgement, local-only dispatch, legacy Host gating, schedule accessibility, Quick Backup parameters and click-to-inspect persistence. Production smoke confirms that development fixtures are unavailable in production.

Fixtures and the volatile action recorder live under `src/ui/fixtures`; the locked adapter remains untouched. Framework route-announcer alerts are excluded only from the unknown-player error assertion; application alerts and all axe rules remain covered. Legacy destination choices are visible but disabled, matching the playbook’s explicit Playwright expectation. This resolves its conflicting prose that says to hide them. The real Java enum supplies the stage terminology and off-site interval.

The final package contains the exact source trees, matching Java artifacts, browser screenshots, compatibility contract fixtures, CI logs and digests. The screenshots use synthetic fixtures. Tests against old/new wire shapes do not constitute a live staging VPS/Drive smoke test. Install the updated Host first; real service, provider and restore acceptance remains an operator staging task.
