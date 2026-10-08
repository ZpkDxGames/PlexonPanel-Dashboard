# 6.0.0 discovery baseline — interrupted checkpoint

Date: 2026-10-08 UTC. Branch: `release/6.0.0`. Source: `86b6a0cefb2c5e420c9c862a7897705e1ea59146`, accepted 5.0.0 activation. **M0 is incomplete; M1 has not started.** This report must not be used as a milestone acceptance receipt.

## Mandatory stop condition

The brief §0.9 says: “Stop and report (do not guess) if … an existing test encodes behavior you believe is wrong.” Section 3 says Paper connectivity must be separate from Host service state and the UI must never fabricate an active service state.

`tests/dashboard-2-1.test.mjs`, test “Paper connection only fills missing service state and never overrides explicit inactive”, requires `normalizeServiceState(undefined, true)` to equal `active`. `lib/lifecycle-state.ts` implements that fallback. `app/dashboard.tsx` uses `normalizeServiceState(state.service.state, paper)` when calculating `restartAvailable`, which is passed to the current command palette. Thus a missing Host state plus connected Paper can make the palette offer a restart as if the service were known active. Host authorization still remains authoritative, but presentation violates the new hard gate.

The Server workspace and `lib/connection-state.ts` already call the same helper with `false`, preserving unknown state. This is a concrete inconsistency, not a request for a new backend capability. No test or implementation has been changed.

### Proposed resolutions for maintainer decision

1. **Recommended:** approve a frontend-only correction for a later implementation milestone: missing Host service state always remains unknown; all lifecycle callers use Host state only; revise the contradictory assertion and add a mounted palette gating regression. Continue M0/M1 with current code/tests unchanged, treating this as an explicitly approved future correction.
2. Keep historical helper behavior solely as a compatibility API, forbid its Paper fallback in every production caller, and add a regression proving it is not used by any service-state/lifecycle presentation. This preserves the old test but leaves misleading dead behavior and adds maintenance cost.

Neither option needs Core, Host, relay, protocol, a VPS restart or production deployment. Approval is needed because the brief explicitly requires stopping on this test conflict.

## Executed gates and provenance

| Gate | Method | Result | Evidence |
|---|---|---|---|
| Entire brief | Read all 534 lines of supplied file | Passed | Root `PLEXONPANEL_6.0.0_REVAMP.md` is an exact copy |
| Instructions | Read AGENTS.md and CLAUDE.md; CLAUDE delegates to AGENTS | Passed | Next breaking-change notice intact |
| Remote source / rollback | `git ls-remote origin HEAD refs/heads/main refs/heads/release/6.0.0 refs/tags/v5.0.0` | Passed | HEAD/main exact SHA above; no tag/release branch returned at discovery |
| Isolation | `git worktree add -b release/6.0.0 … 86b6a0c…` | Passed | Isolated worktree; no edits to main |
| Untouched install | `npm ci` | Passed | 415 packages; Node v24.19.0, npm 11.9.0 |
| Untouched checks | `npm run check` | Passed | Scope/fleet generation checks, lint, typecheck, 79 relay tests, 183 dashboard tests; 0 failed/skipped/cancelled |
| Next guidance | Installed `next/dist/docs/01-app` font, CSS, lazy-loading, server/client material | Read | Dynamic import boundaries, local font paths and production CSS ordering noted; no Next code written |
| Baseline screenshots | Signed loopback relay + Next + Playwright capture attempted | Failed | Initial browser missing; Playwright install returned invalid ZIPs; fallback Chromium 153 launched but EGL initialization failed |
| Screenshot matrix | 13 workspaces plus pairing/legacy route, light/dark, 390/768/1280/1920 | Not executed | Zero screenshots captured; failed attempt is not visual evidence |
| Baseline axe | Capture harness intended scans | Not executed | Browser did not reach a page |
| M1 font/contrast experiments | Not started | Not executed | Stop condition found before M0 completion |
| M1 design / M2+ / deployment | Not started | Not executed | Explicit session boundary and stop rule |

The check command ran before any tracked file changes. Next dev subsequently regenerated `next-env.d.ts`; that generated change was restored byte-for-byte from the source anchor. The branch checkpoint contains documentation only. Local agents were simulated with fresh random identities and signed messages, with no Minecraft/systemd/RCON actions or deployed credentials. The attempted screenshots never exposed credentials. Live PlexonCraft acceptance is not implied.

## Preliminary route and owner map

The app has `/` (server selector and selected-server workspaces), `/activity` (read/clear-only legacy archive), and `/api/build` (nonsecret deployment build identity). Boot, pairing, confirmations and command palette live in `app/dashboard.tsx`, not separate routes.

Canonical `ViewProps` in `app/control-views.tsx`: `state: ControlState`, optional `deviceGrant: EffectiveDeviceGrant`, `can(action, kind?)`, `run(action, parameters, kind?, confirmationMode?)`, `notice`, `connected`, optional `setUnsaved`. Production availability is live session + reconciled signed grant + compatible target + connected authority + canonical scope/capability intersection; op/deop are Owner-only. High-risk actions, console execution and configured plugin reload use server/action/parameter-bound confirmations, with target generation checked before dispatch/completion.

| Workspace | Current owner / extra props | Principal data owners and gates |
|---|---|---|
| Fleet | `app/fleet-overview.tsx`; credentials/selected/connected/openServer/pair/labels/rememberName/phase | Existing FleetFeed + fleet-model + connection-state; authenticated per-instance feeds, shared node totals once |
| Overview | `app/overview-view.tsx`; ViewProps | metric-reports/chart-geometry/telemetry-freshness/fleet-model; per-source freshness, safe diagnostics, Paper history entry |
| Performance | `app/performance-view.tsx`; props/resetHistory | metric-reports/chart-geometry/shared telemetry-clock/preferences; browser-local pause/reset/export; no long history |
| Players | `app/players-view.tsx` + `player-roster.tsx`; ViewProps | durable-activity/device grant; players.view, players.history.view plus Paper capability; player.* through can/run |
| Console | `app/console-view.tsx`; ViewProps | signed data-source/control-state; Host history full/errors; Paper-only execute; bounded local view controls |
| Chat | `app/communication-views.tsx` ChatView; ViewProps | control-state; chat.view, chat.send alias, optional MiniMessage scope |
| Plugins | `app/communication-views.tsx` PluginsView; ViewProps | Paper inventory; plugins.view and configured plugin.command.reload → plugins.reload |
| Server | `app/server-view.tsx`; ViewProps | lifecycle-state/operation-messages; Host server.status/start/stop/restart, stable state + busy |
| Backups | `app/backups-view.tsx`; ViewProps | backup-readiness; Host maintenance/provider/full backup actions, durable job and matching live job ID |
| Configuration | `app/configuration-view.tsx` + `advanced-views.tsx` FilesView; ViewProps | Signed files workflow; prefers Paper listing; selected agent pinned; Host policy read-only; edit/create/upload/rename/delete/download existing gates |
| Audit | `app/governance-views.tsx` AuditView; ViewProps | useQuery; selected Paper/Host audit.list or audit.self; bounded 50-record pages |
| Access | governance AccessView; ViewProps + forget/pair | generated scopes + effective grant; devices.list/revoke; immutable grant disclosure; local forget |
| Settings | `app/settings-view.tsx`; ViewProps + reconnect | existing single ui-preferences provider; diagnostics/build/version metadata; local appearance controls |
| Pair/boot/shell | `app/dashboard.tsx` | data-source/browser-store/control-state/device-grant/display-cadence; pairing and immutable bound operations |
| Legacy archive | `app/activity/page.tsx` | activity-history/avatar-provider; bounded existing unverified entries, local clear only, no Paper journal merge |

## Source-level catalogues

`UI_6_SOURCE_CATALOGUE.json` contains the exact source expressions from all 29 app/components TSX files: 228 control declarations (buttons, forms, inputs, selectors, dialogs, disclosures, links and progress controls), ancestor conditions, disabled/event attributes, labels, full source fragments, imports, function parameter types and 2,328 property-read expressions. Mapped controls retain their source array/condition rather than being mistaken for one runtime button. This is a reproducible raw parity index, **not** a completed manual authorization audit. Its file/line anchors refer to the source SHA, not future code.

`UI_6_TEST_CATALOGUE.md` records titles in all 31 dashboard test files. The runtime check totals above are authoritative. Several suites contain static source assertions, so a green suite alone does not certify interaction or styling parity. `scripts/verify-ui-browser.mjs` covers signed simulated agents, populated workspaces, six widths, light/default and dark/high-contrast/125% variants, mobile drawer keyboard/inert behavior, selected-server switching, chart keyboard inspection, scoped export, stale/Paper-offline/stopped states, an uploading durable job, axe, and a timed Performance soak. It does not capture every requested M0 width/theme per workspace; M0 needs its own matrix without overwriting the accepted 5.0 evidence.

## Preliminary data truth map

All dynamic JsonMap fields may be absent unless validated, so missing numbers remain unavailable. Source-capture timestamps and receipt (`updatedAt`, `telemetryUpdatedAt`) are separate. History is 35 minutes / 8,192 records; metricSeries deduplicates each source timestamp and preserves provenance. Display cadence defaults to 500 ms, selectable 0/250/500/1000/2000; operational messages bypass it.

| Fields / adapter | Source | Unit / nominal cadence | Missing behavior |
|---|---|---|---|
| server.capturedAt, server.tps[0], averageTickMillis, onlinePlayers, maximumPlayers | Paper health | ISO time, ticks/s, ms, counts; adapter 2 s | nullable; never synthesize zero |
| system.capturedAt, processCpuPercent, jvmHeapUsedBytes/jvmHeapMaximumBytes, gcPauseTotalMillis, processUptimeMillis, javaVersion/operatingSystem/architecture | Paper JVM/process | CPU % machine capacity, bytes, ms, text; adapter 5 s | independent from Host |
| hostSystem.capturedAt, nodeId, hostCpuPercent, physicalMemoryUsedBytes/physicalMemoryTotalBytes, diskUsedBytes/diskTotalBytes, operatingSystem/architecture | Host machine | CPU % machine capacity, bytes; adapter 250 ms | fresh node sample only; no Paper substitution |
| service.state, service/service pid, mainPid, minecraftReady, recoveryRequired | Host service status | enum/text/boolean; signed status cadence | unknown remains unknown in Server; shell fallback is the blocker |
| service.resources.capturedAt/scope/source/cpuUnit/cpuAvailable/cpuPercent/memoryAvailable/memoryBytes | Host systemd cgroup | % one core (can exceed 100), bytes; adapter 5 s | requires MINECRAFT_SERVICE + SYSTEMD_CGROUP; exact unit/availability flags |
| worlds[].name/players/loadedChunks/entities | Paper worlds | text/counts; push | optional; current Overview gates on health freshness |
| players[].uuid/name/displayName/world/pingMillis/gameMode/health/maximumHealth/food/experienceLevel/op/whitelisted/onlineDurationMillis/sessionId/sessionStartedAt/firstSeenAt/lastLoginAt/position/address | Paper roster/presence | identifiers/text/ms/counts/coordinates/address; pushed inventories + immediate presence deltas | snapshot/session reconciliation; sensitive fields require grant and actual supply; explicit drawer scope recheck needs parity coverage |
| plugins[].name/version/enabled/authors/description/dependencies/softDependencies/website | Paper inventory | metadata; push | optional details only; configured reload capability |
| ready.consoleAuthority/consoleSourceState; console[].capturedAt/content/level/source/journalCursor/journalEpoch/invocationId/streamSession/sourceSequence | Relay-signed authority, Host replay or authorized Paper live fallback | enum/time/text/IDs; immediate | full/errors visibility; 2,500 lines; cache at most 500 |
| chat[].messageId/capturedAt/playerName/content/source/integration | Paper chat | time/text; immediate | 200 messages; current safeCache keeps up to 100 (brief §9.7 says no persistence) |
| history[].at/sources/tps/mspt/hostCpu/processCpu/heap/memory/players/gc/serviceCpu/serviceMemory | Reducer observations | source-specific units/cadence above | source captures optional for bounded legacy adapter; no interpolation across gaps |
| backupProgress.jobId/phase/progress/bytesUploaded/bytes/totalBytes/bytesPerSecond/providerState/warnings | Host live progress | ratio/bytes/bytes per second; immediate | only current matching durable job, phase not behind durable state; one latest progress payload |

Backup reads also come from scoped action results, not just reducers: maintenance.status/currentOperation has jobId, operationId, type, phase, phaseTimestamp, startedAt, result, backupId, progressPercent, localBackupVerified, remoteBackupVerified, warnings and recovery flags; countdownRemainingSeconds/countdownInitialSeconds and commandChannel.enabled belong to status. Preflight carries hostAuthenticated, operationBusy, recoveryRequired, backupRootWritable, commandChannelConfigured, usableBytes/backupRootUsableBytes, requiredBytes, unreadableDurableCount, missingIncludes, symlinkIssues, provider/providerStatus/remote. Provider status and backup list retain distinct connectivity-test and remote-verification fields. Settings preserve timezone, restart schedule/frequency/weekdays/time/countdown/stop/start timeouts and manual-backup retention/filename fields. No provider credentials are required by the view.

Exact current phase keys: QUEUED, PREFLIGHT, COUNTDOWN, FINAL_SAVE, STOPPING_SERVER, WAITING_FOR_STOP, ARCHIVING, HASHING, VERIFYING_LOCAL, UPLOADING_REMOTE, VERIFYING_REMOTE, CLEANING_LOCAL, STARTING_SERVER, VERIFYING_STARTUP, COMPLETED. Additional outcomes DEGRADED, FAILED and RECOVERY_REQUIRED have explicit behavior; recovery is blocking, not normal completion.

## Other findings requiring the full baseline/design pass

- Overview is six equal metric tiles: TPS, MSPT, online players, JVM heap, service CPU, service RAM. Performance has nine charts (six primary plus players/service CPU/service RAM), not only six. Preserve these capabilities in a designed hierarchy. No new metrics are needed.
- Access still labels Files/Backups “Advanced / Future” and claims 3.0 does not expose them; these are active. Copy should follow actual current ownership.
- Fleet already publishes ControlState histories through existing FleetFeed, so observed mini Pulse does not need a second transport.
- Preferences default to light/monochrome/compact, with existing accent enums monochrome/cyan/violet/emerald/amber. New names/defaults must preserve saved choices and require additive parsing/migration tests.
- Current command palette includes an actual restart entry (bound confirmation still applies); the brief wants navigation only. Proposed new palette must navigate to Server rather than execute.
- Current Configuration already has a local original/edited diff and hash conflict preservation. New save confirmation should be added only through the existing bound action path; do not drop dirty-leave protection, download verification/cancellation, create/upload/rename/delete scopes.
- One latest backup progress event exists; do not invent simultaneous compression/upload counters or reload-retained phase counters. In a design, inactive/unknown bars must explicitly say not supplied.
- Current chat is persisted by safeCache up to 100 messages; §9.7 calls for no persistence. This needs an explicit design/migration decision; no change was made.
- Legacy Activity retirement conditions are not proved; retain its bounded cleanup capability. Optional applied-skin fallback remains until supported Core agents supply the canonical field.
- `lib/cpu-load.js` is unused by app/components but its tests preserve a combined system/process fallback. Do not use it for 6.0 monitoring; decide whether to remove the dead helper and obsolete tests with a later approved cleanup.

No visual pain points beyond source-observable hierarchy/copy are claimed: browser screenshots are unavailable. Full state matrices (loading/empty/stale/disconnected/degraded/forbidden/busy/error), per-control manual rules, complete semantic field interpretation, screenshot review, performance baseline and test-gap prioritization remain to complete after the stop condition is resolved.
