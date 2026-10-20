# PlexonPanel v6.0 binding and preservation receipt

Phase 0: both GitHub main branches were read before editing. Dashboard baseline is bd6efa6bc087e4bf05a34e41e66533e291e79db3 (tree a16a2959cb95bd8205500f5ebcc21593740425ec); Host baseline is 82051f00a528b411268998755e581a9d767a9dcf (tree a7a4d1d8ce56ba44a163352cde0ba1a09c10fd32). Local commits were imported equivalents: backend has exactly the same 336 blobs, dashboard has all 159 remote blobs unchanged plus three local support files (.purge/core-sha256.json, .purge/tokens.css, src/vite-env.d.ts). These extras are excluded from remote release changes. No application source differs at baseline.

| Playbook placeholder | Real binding |
| --- | --- |
| Host package | io.github.zpkdxgames.plexonpanel.host, host-agent/src/main/java/io/github/zpkdxgames/plexonpanel/host/ |
| MaintenanceSettings | MaintenanceSettings.java, schema 2; FullRestorePoint.schedule/retentionCount/excludes/maximumBytes |
| Recovery journal | MaintenanceStateStore.recoveryRequired()/active()/markRecovered(); FullRestorePointManager.recoveryRequired() for interrupted restore journal |
| Source resolver and exclusion predicate | FullBackupSource.walk(root, includes, settings, Visitor), shared by archiver and preflight; FullBackupSource.excluded(Path relative, settings) |
| Provider probe | FullRestorePointManager.providerStatus()/testProvider(int seconds); fixed /usr/bin/rclone via HostConfig.BackupConfig |
| Typed failure | protocol/.../control/OperationFailure, unchecked; existing safe error contract retained |
| Job creation, runner and lock | MaintenanceManager.queue()/runFull(), MaintenanceStateStore.begin()/transition()/finish(), operationLock and NodeBackupCoordinator lease |
| Archive creation and verification | FullRestorePointManager.createLocked(..., boolean uploadOffsite), verify(backupId), retryUpload(backupId, jobId, FullRestorePoint) |
| Minecraft readiness | MinecraftCommandChannel.enabled()/readinessProbe(), SystemdService.status() state=active |
| Host broadcasts | MessageSink.send(type, body, MessagePriority.EVENT), MaintenanceManager.publish()/publishPhase() |
| Host action parameters | HostMain switch uses JsonObject p; optional params added to existing action handlers |
| Dashboard pass-through | src/adapter/session.ts prepare() structuredClone(parameters); execute() spreads parameters into sendDashboardAction. No fixed parameter schema; all 27 locked files remain untouched. |
| Dashboard Host reads and mutations | src/ui/bindings/index.ts useQuery()/session.query/prepare/execute; useReview() via MutationContext preserves destructive review and exact-generation checks |
| Backup presentation inputs | useControl().state.maintenancePhase and backupProgress plus useQuery maintenance.status/settings.get, backup.full.list. There is no backup selector in locked src/presentation; keep these existing inputs. |
| Settings action | maintenance.settings.update with {settings: complete schema-2 settings}; allowLocalFallback nested under fullRestorePoint |
| Verify / promote / restore | backup.full.verify / backup.full.retry-upload / backup.full.restore; restore retains backup.full.restore.prepare token and exact server-name review |
| Custom controls | src/ui/primitives/Select.tsx PpSelect; .pp-seg and aria-pressed buttons used by TelemetryStudio Focus/Split. Existing Radix Dialog and ReviewProvider retained. |
| Byte/time helpers | src/ui/bindings/index.ts gib(), date(), time(); no src/lib/format exists |
| Countdown | maintenance.status already has countdownState ACTIVE/UNAVAILABLE, countdownRemainingSeconds, countdownDeadline, countdownInitialSeconds; add kind/endsAt/totalSeconds/IDLE/recoveryRequired without renaming old fields. Dashboard receives state.maintenancePhase but no maintenance.status event selector; UI polling fills the seam. |
| Readout bar | src/ui/telemetry/ReadoutBar.tsx, globals.css .pp-readout-bar; parent workbench row is auto |
| Roster/event/selection | Overview.tsx active roster; players/PlayerEventsDock.tsx; Players.tsx selected uuid and virtualizer; useViewSync returns object with patch(), not a tuple |
| Fixture mechanism | bindings/startup.ts dynamically imports src/development/fixtures only in development; v6 wrappers/recorder added under src/ui/fixtures, never locked core |
| QA runners | scripts/structure-qa.mjs, polish-checks.mjs, polish-runner.mjs, production-qa.mjs; tests/fixtures/core-sha256.json is tracked baseline copy of .purge hash contract |

## Authoritative stage mapping

| Index | Enum key | Label |
| --- | --- | --- |
| 1 | PREFLIGHT | Preflight |
| 2 | ACQUIRE_LOCK | Acquire lock |
| 3 | ANNOUNCE | Announce to players |
| 4 | COUNTDOWN | Countdown |
| 5 | SAVE_ALL_FLUSH | Save-all flush |
| 6 | STOP_SERVICE | Stop service |
| 7 | STOP_PROOF | Systemd stop proof |
| 8 | BUILD_MANIFEST | Build manifest |
| 9 | ARCHIVE_PARTIAL | ZIP to .partial |
| 10 | FINALIZE_ARCHIVE | Finalize ZIP |
| 11 | LOCAL_SHA256 | Local SHA-256 |
| 12 | UPLOAD | Upload to Google Drive |
| 13 | REMOTE_SHA256 | Remote SHA-256 verify |
| 14 | RESTART_RELEASE | Restart and release lock |

The illustrative STOPPING_SERVER enum does not exist: it is a durable job phase mapped to BackupStage.STOP_SERVICE. VERIFYING_LOCAL maps to LOCAL_SHA256 and STARTING_SERVER/VERIFYING_STARTUP map to RESTART_RELEASE. Skipped off-site indices are derived strictly between these real enum entries: 12 and 13. Legacy frontend labels are pinned against this enum by tests.

## Execution notes

The attached user prompt explicitly authorizes both main pushes and takes precedence over the playbook’s no-push guideline. Host first, Dashboard second. The optional automatic recovery reconciliation is not enabled. Production VPS service installation and real world/archive operations require access not present in this workspace; CI and fixture receipts must not be represented as a live staging Host smoke test.


## UI adaptations pinned by browser checks

The pipeline reuses `.pp-pipeline` with `.pp-backup-rail`; `.pp-rail` already names the navigation. The appended four-cell ribbon rules are scoped to `.pp-durability`, preserving the five-cell telemetry ribbons. Destination buttons reuse `.pp-seg`, with the native button radio role, checked state, roving focus and arrow/Home/End navigation. Player events retain native list items and use native buttons inside them; assigning a button role directly to a list item fails axe and is not retained. Unknown-selection tests exclude only Next’s built-in empty route-announcer alert; all application error alerts remain covered.

The countdown/status and preflight provider is shared between the header and route, polls only while visible, ticks from a monotonic receipt timestamp, and retains session scope/generation checks. A failed preflight refresh removes stale actionable green data. The global header always sends AUTO and 300 seconds; the legacy workbench omits unsupported optional mode parameters.
