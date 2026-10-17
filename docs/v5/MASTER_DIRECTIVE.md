# PlexonPanel 5.0 Full Release — Project Instructions & Master Directive for GPT-6.1 Sol

**Target Model**: GPT-6.1 Sol (Autonomous Full-Stack & Systems Engineering Lead)
**Target Release**: PlexonPanel `5.0.0` Full Production Release (Next.js Dashboard + VPS Host Relayer Companion + Paper 26.2 Plugin)
**Protocol Baseline**: Signed Wire Protocol `3` (`X-PlexonPanel-Protocol: 3`), Configuration Schema `5`, Java `25`, Node `24.x`
**Repository Baselines**:
- **Plugin & Host Companion (`ZpkDxGames/PlexonPanel`)**: Base commit `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128` (Tree `4754ccb1a80c69eacde903a1883b40454cab7c32`)
- **Web Dashboard (`ZpkDxGames/PlexonPanel-Dashboard`)**: Base commit `4357a66bc674fddce7432cbc27a4fead00ac8234` (Tree `17f44ce9ca5d282b5b9236dd35be451066a9cad2`)

## 1. Superseding Authority & Mission Mandate

You are **GPT-6.1 Sol**, acting as Principal Systems Architect and Lead Full-Stack Engineer for the full v5.0 release of **PlexonPanel**.

**CRITICAL OVERRIDE OF LEGACY PLANNING FILES**:
The existing `PlexonPanel-Dashboard` repository contains historical planning documents (`AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/next-gen/planning/*`) that previously prohibited migrating to Next.js, prohibited utility CSS frameworks (Tailwind), restricted backups to manual-only (`STEP5_MANUAL_ONLY_BACKUP_MIGRATION.md`), and cached up to 500 console lines in browser IndexedDB (`src/adapter/browser-store.ts`). **This instruction document explicitly supersedes those legacy restrictions.** Whenever a rule in `AGENTS.md` or `docs/next-gen/*` conflicts with this specification, **this document is the supreme authority**.

### Core Objectives
1. **Preserve the Proven Core Protocol & Security Plumbing**: Retain 100% of Wire Protocol 3 (Ed25519 signed envelopes, `_session` and strictly increasing `_sequence` replay guards, Caddy reverse-proxy TLS termination, 5-minute peppered OTP device pairing via `/v1/pairings/claim`, `/v1/dashboard/session` preflight, `plexonpanel-v3` WebSocket subprotocol, and the split authority between the Paper 26.2 plugin and the 24/7 non-root Linux Host Companion).
2. **Rebuild the Web Dashboard from the Ground Up (Next.js + Tailwind CSS + shadcn/ui)**: Replace the Vite/custom-CSS SPA (`Control Room` / `Strata` candidate) with a brand-new, high-density **Next.js (App Router, React 19, TypeScript)** application styled with **Tailwind CSS**, **shadcn/ui (Radix UI)**, **Lucide Icons**, **TanStack Virtual**, and **uPlot / Recharts** for high-frequency performance telemetry, deployed on **Vercel**.
3. **Eliminate Web-Cache Console Storage & Move Persistence to VPS SQLite + JSON**: Remove all console log and chat persistence from browser `IndexedDB` (`plexonpanel-browser-v3` in `src/adapter/browser-store.ts`). Persist console logs, server lifecycle events, and player join/leave events on the VPS inside the 24/7 Host Companion (`host-agent`) using a local **SQLite (WAL mode)** database alongside a real-time **`.json` presence snapshot (`player-events-current.json`)** that automatically rotates/refreshes on every server restart or shutdown-then-start cycle.
4. **Upgrade Performance Telemetry Graphs**: Replace the single-track basic SVG chart (`src/components/charts/TimeSeries.tsx`) with multi-layer, synchronized Canvas/SVG telemetry workspaces supporting TPS/MSPT percentile bands (mean, p95, p99), JVM Heap vs. systemd cgroup memory vs. Node physical RAM separation, per-world entity/chunk breakdowns, GC pause overlays, and interactive time-brush zoom without main-thread frame drops.
5. **Deliver Unified Manual + Periodic Cold Backups to Google Drive via Host Companion**: Orchestrate all backups through the 24/7 VPS Host Companion (`host-agent`)—never inside the Paper plugin—because the Minecraft server must be cleanly stopped before archiving. Support both **Manual ("Fully Backup Now")** and **Periodic Scheduled Cold Backups** (daily, weekly, or selected weekdays) with RCON player countdowns, `save-all flush` verification, systemd stop proof, `.partial` crash-safe ZIP staging, SHA-256 verification, Google Drive promotion via isolated `/usr/bin/rclone`, and automatic server restart.

## 2. Ready-to-Paste Kickoff Prompt for GPT-6.1 Sol

Copy and paste the block below as your opening prompt when attaching `PlexonPanel-main.zip`, `PlexonPanel-Dashboard-main.zip`, and this instruction file to GPT-6.1 Sol:

> You are GPT-6.1 Sol, Principal Full-Stack & Systems Engineer for the PlexonPanel 5.0 Full Release.
>
> I have attached both repository archives (`PlexonPanel-main.zip` for the Paper 26.2 plugin + Java 25 Linux Host Companion, and `PlexonPanel-Dashboard-main.zip` for the Web Dashboard) alongside `PLEXONPANEL_V5_GPT6_1_SOL_PROJECT_INSTRUCTIONS.md`.
>
> First, read `PLEXONPANEL_V5_GPT6_1_SOL_PROJECT_INSTRUCTIONS.md` in full. Note that its **Superseding Authority Clause** explicitly overrides the legacy constraints in `PlexonPanel-Dashboard/AGENTS.md` and ` PlexonPanel/docs/STEP5_MANUAL_ONLY_BACKUP_MIGRATION.md`: you ARE authorized and instructed to migrate the dashboard to Next.js + Tailwind CSS + shadcn/ui on Vercel, remove console/chat caching from browser IndexedDB, implement VPS-side SQLite + `.json` session-scoped event/log storage on the Host Companion (refreshing on every server restart or shutdown-then-start cycle), and enable both manual and periodic scheduled cold backups to Google Drive via the Host Companion.
>
> Execute the work in the exact phased order defined in Section 9 of the instructions:
> 1. Audit and extract the reusable Protocol 3 TypeScript adapter layer (`src/adapter/*`, `src/presentation/{authority,epochs,review-policy}.ts`, `src/features/capabilities.ts`).
> 2. Implement the backend upgrades in `PlexonPanel` (`host-agent` SQLite + `.json` epoch-reset persistence for console logs and player events, plus periodic + manual Google Drive cold-backup scheduling in `MaintenanceSchedule.java` / `MaintenanceManager.java`).
> 3. Scaffold and build the new Next.js App Router + Tailwind CSS + shadcn/ui dashboard across all 8 operational views (`Fleet`, `Overview`, `Performance`, `Players`, `Console & Chat`, `Backups`, `Access & Audit`, `Settings`), integrating high-density performance graphs and zero-web-cache log streaming.
> 4. Run full type-checking, unit/contract tests, and build verification across both repositories.

## 3. System Topology & Preserved Core Logic

Do not alter the cryptographic trust model or network topology. Every new feature must plug cleanly into this four-part architecture:

| Component | Runtime & Location | Core Responsibilities | Non-Negotiable Security Boundary |
| :--- | :--- | :--- | :--- |
| **Paper Plugin (`agent/`)** | `PlexonPanel-5.0.0.jar` on Paper `26.2` (Java 25) inside Minecraft JVM | Samples 4 Hz TPS/MSPT (`PaperSnapshotCollector.java`), JVM heap/GC, world chunks/entities, plugin list, online players, live chat (`ChatStreamService.java`), and executes allowlisted Bukkit/Paper commands (`PaperActions.java`). Generates 5-minute one-time pairing codes (`/plexonpanel pair <Role>`). | Owns device pairing and in-game command execution. Never runs backups or systemd service commands. |
| **VPS Host Companion (`host-agent/`)** | `plexonpanel-host-5.0.0.jar` (Java 25) running 24/7 as non-root `pph-<key>` (`plexonpanel-host@<key>.service`) | Controls `minecraft@<key>.service` via Polkit, samples systemd cgroup CPU/memory (`ServiceResourceSampler.java`) and Node hardware metrics, captures console logs & player events into VPS SQLite + `.json`, and executes cold Google Drive backups via `/usr/bin/rclone` and loopback RCON (`127.0.0.1:25575`). | Mounts `serverRoot` read-only (`instance-read-authority.py`). Forces `files.write/create/delete` and remote `backup.restore` off. Survives Minecraft stops/crashes. |
| **VPS Relayer & Caddy Proxy** | 24/7 VPS service fronted by Caddy HTTPS/WSS reverse proxy | Terminates TLS via Caddy, exposes `POST /v1/pairings/claim`, `GET /v1/dashboard/session`, `WSS /v1/agent`, and `WSS /v1/dashboard`. Verifies Ed25519 agent signatures, enforces per-session sequence numbers, and routes scoped actions/events between paired browsers and agents. | Stateless message router for telemetry/logs; never exposes RCON or rclone secrets to browsers. |
| **Web Dashboard (`PlexonPanel-Dashboard`)** | Next.js App Router + Tailwind CSS hosted on **Vercel** | Authenticates via origin-bound IndexedDB HMAC bearer token (`plexonpanel-browser-v3`), maintains 1 active control WebSocket + up to 15 passive fleet feeds, renders real-time telemetry, streams VPS SQLite logs/events, and dispatches reviewed mutations (`session.prepare` → `ActionReview` → `session.execute`). | Stores **only** device credentials in IndexedDB and 8 UI preferences in `localStorage`. Zero console/chat/log caching in browser storage. |

### Preserved Protocol 3 Wire Invariants
- **Signed Agent Envelope (`protocol/envelope.schema.json`)**: Every message on `/v1/agent` must have `protocolVersion: 3`, `type`, `messageId` (UUID), `serverId` (Paper UUID), `timestamp` (UTC ISO-8601 within ±30s), `body` (unpadded Base64URL JSON ≤ 65,536 decoded bytes), and `signature` (Ed25519 over `3
&lt;type&gt;
&lt;messageId&gt;
&lt;serverId&gt;
&lt;timestamp&gt;
&lt;body&gt;` with no trailing LF).
- **Session &amp; Sequence Guard**: Agent-to-relay bodies include `_session` (random UUID per WebSocket connection) and strictly increasing `_sequence` (starting at `1` on `agent.hello`).
- **Caddy + OTP Pairing Handshake**:
  1. Operator runs `/plexonpanel pair &lt;Owner|Administrator|Moderator|Observer&gt;` in-game or via console.
  2. Paper sends `agent.pairing_begin` with the peppered 5-minute one-time code to the VPS Relayer.
  3. User enters Device Name + OTP Code in the Dashboard Pairing Gate (`POST /v1/pairings/claim` through Caddy HTTPS).
  4. Relayer sends `pairing.consume` to Paper; Paper writes to `plugins/PlexonPanel/access/devices.json` and mirrors to Host (`/var/lib/plexonpanel/instances/&lt;key&gt;/access/devices.json`) via `access.sync`, returning an HMAC bearer credential stored exclusively in browser IndexedDB (`plexonpanel-browser-v3`).
  5. Browser connects to `WSS /v1/dashboard` using WebSocket subprotocols `[&quot;plexonpanel-v3&quot;, &quot;auth.&lt;credential&gt;&quot;]`.
- **Fail-Closed Mutation Pipeline**: Every mutating action in the UI must call `session.reason(action, agentKind)` to verify scope + capability intersection, `session.prepare(...)` to freeze `{ serverId, session, generation, agentKind, action, parameters }`, render the confirmation modal (`ActionReview`), and call `session.execute()`. Transport `dashboard.action_queued` is only routing acceptance; wait for private `server.event` (`eventType: &quot;action.result&quot;`) or durable Host maintenance status. Never auto-retry mutations on timeout.

## 4. Feature Specification 1: VPS SQLite + JSON Event & Console Persistence (Zero Web Cache)

### 4.1 Browser Cache Elimination (`PlexonPanel-Dashboard`)
In the existing dashboard, `src/adapter/browser-store.ts` (`saveWorkspaceState` / `loadWorkspaceState`) and `src/adapter/control-state.ts` (`persistableControlState`, lines 475–492) persist up to 500 console lines and 100 chat messages into browser IndexedDB (`plexonpanel-browser-v3`).
- **Required Change**: Strip `consoleLines`, `chatMessages`, and `presenceEvents` from `persistableControlState` in `src/adapter/control-state.ts` and `src/adapter/browser-store.ts`.
- Browser IndexedDB must store **only** paired device credentials, server directory metadata (`serverId`, `serverName`, `relayOrigin`), and non-sensitive UI preferences in `localStorage` (`plexon:preferences`).
- All console history, chat history, and player join/leave logs displayed on the dashboard must come live from the VPS Host Companion (`host-agent`) over the WebSocket session and be held only in bounded volatile React memory while the tab is open.

### 4.2 VPS Host Companion SQLite + `.json` Storage Architecture (`PlexonPanel/host-agent`)
Create a new persistence package in `host-agent/src/main/java/io/github/zpkdxgames/plexonpanel/host/storage/` (using `org.xerial:sqlite-jdbc` in `host-agent/build.gradle.kts` alongside `Gson` atomic file writes):

1. **Storage Paths (under Host `dataDirectory`, e.g., `/var/lib/plexonpanel/instances/<key>/telemetry/`)**:
   - `session-telemetry.sqlite` (SQLite database in `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`, permissions `0600`).
   - `player-events-current.json` (Atomic JSON file containing the current boot session's player join/leave timeline and active online roster summary, permissions `0600`).

2. **Boot Epoch Lifecycle & Automatic Reset on Server Restart / Shutdown-Start**:
   - Define a **Boot Epoch (`bootEpochId`)** tracked by `HostMain.java` and `SystemdService.java` via the systemd unit's `InvocationID` (32-hex systemd invocation identifier) and active state transitions (`inactive`/`failed`/`deactivating` → `active`).
   - **Refresh Trigger**: Whenever the Minecraft server restarts (`server.restart`, scheduled restart, or in-game restart) or goes through a **Shutdown → Start** cycle (`server.stop` followed by `server.start`, or cold backup stop → start):
     1. `HostSessionStore` detects the new systemd `InvocationID` (or transition from `stopped` to `running`).
     2. Executes an atomic **Session Reset**: truncates/rotates the previous boot epoch rows in `session-telemetry.sqlite` (`DELETE FROM console_logs; DELETE FROM server_events; DELETE FROM player_presence_events; VACUUM;` or archives the last epoch if configured, keeping the active tables strictly scoped to the new server boot) and atomically overwrites `player-events-current.json` with a fresh empty epoch header:
        ```json
        {
          "schemaVersion": 5,
          "serverId": "<server-uuid>",
          "bootEpochId": "<new-32-hex-invocation-id>",
          "bootStartedAt": "2026-10-17T14:30:00Z",
          "onlineCount": 0,
          "activePlayers": [],
          "events": []
        }
        ```
     3. Emits a `server.event` with `eventType: "session.epoch_reset"` (`{ bootEpochId, bootStartedAt }`) to connected dashboards so the frontend immediately clears stale prior-boot console lines and presence badges.

3. **SQLite Schema (`session-telemetry.sqlite`)**:
   ```sql
   CREATE TABLE IF NOT EXISTS boot_epoch (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     boot_epoch_id TEXT NOT NULL,
     started_at TEXT NOT NULL,
     previous_stopped_at TEXT
   );

   CREATE TABLE IF NOT EXISTS console_logs (
     seq INTEGER PRIMARY KEY AUTOINCREMENT,
     boot_epoch_id TEXT NOT NULL,
     captured_at TEXT NOT NULL,
     level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
     source TEXT NOT NULL DEFAULT 'HOST_JOURNAL',
     logger TEXT,
     message TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_console_epoch_seq ON console_logs(boot_epoch_id, seq DESC);
   CREATE INDEX IF NOT EXISTS idx_console_level_seq ON console_logs(level, seq DESC);

   CREATE TABLE IF NOT EXISTS player_presence_events (
     event_id TEXT PRIMARY KEY,
     boot_epoch_id TEXT NOT NULL,
     session_id TEXT NOT NULL,
     player_uuid TEXT NOT NULL,
     player_name TEXT NOT NULL,
     action TEXT NOT NULL CHECK (action IN ('JOINED', 'LEFT')),
     observed_at TEXT NOT NULL,
     session_started_at TEXT NOT NULL,
     session_ended_at TEXT,
     session_duration_ms INTEGER,
     termination TEXT NOT NULL CHECK (termination IN ('OPEN', 'QUIT', 'KICK', 'UNKNOWN_DISCONNECT'))
   );
   CREATE INDEX IF NOT EXISTS idx_presence_epoch_time ON player_presence_events(boot_epoch_id, observed_at DESC);
   CREATE INDEX IF NOT EXISTS idx_presence_uuid ON player_presence_events(player_uuid, observed_at DESC);

   CREATE TABLE IF NOT EXISTS server_events (
     event_id TEXT PRIMARY KEY,
     boot_epoch_id TEXT NOT NULL,
     captured_at TEXT NOT NULL,
     category TEXT NOT NULL CHECK (category IN ('LIFECYCLE', 'MAINTENANCE', 'BACKUP', 'MODERATION', 'PLUGIN', 'ALERT')),
     severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR')),
     actor TEXT,
     summary TEXT NOT NULL,
     payload_json TEXT
   );
   CREATE INDEX IF NOT EXISTS idx_events_epoch_time ON server_events(boot_epoch_id, captured_at DESC);
   ```
   - **Ring-Buffer Cap per Boot Epoch**: Enforce a configurable row cap in SQLite (default `50,000` console lines and `10,000` server/player events per boot epoch) using a fast periodic prune (`DELETE FROM console_logs WHERE seq <= (SELECT MAX(seq) - 50000 FROM console_logs)`) so a long-running boot never exhausts VPS disk space.
   - **Redaction**: All lines ingested from `JournalSource.java` must pass through `ConsoleRedactor` and `ConsoleClassifier` **before** SQLite insertion.

4. **Dual Write for Player Join/Leave Events (SQLite + `.json`)**:
   - When Paper emits `players.presence` (`JOINED` / `LEFT`) or when the Host Companion observes player presence deltas via relay sync / log parsing:
     - Insert the validated record into `player_presence_events` in `session-telemetry.sqlite`.
     - Atomically update `player-events-current.json` (via temporary `.tmp` + `ATOMIC_MOVE` in `AtomicFiles`) so the Host Companion has both relational query capability (SQLite) and an instant zero-query JSON document (`player-events-current.json`) for initial dashboard hydration (`players.presence.current_epoch`).
   - On server shutdown, any still-`OPEN` player sessions in `player-events-current.json` and SQLite are finalized as `QUIT` / `UNKNOWN_DISCONNECT` before the next boot epoch resets both stores.

5. **Protocol 3 Query Integration**:
   - Update `HostConsoleHistory.java` (`console.history` and `console.history.errors`) to query `console_logs` in `session-telemetry.sqlite` first (supporting instant cursor pagination by `seq`, severity filtering `levels`, and full-text substring search `query` server-side!), falling back to `/usr/bin/journalctl` only if SQLite is disabled.
   - Add additive Host query action `events.session.list` (scope `overview.view` / `players.view`) returning the current `bootEpochId`, `player-events-current.json` payload, and recent `server_events` from SQLite.

## 5. Feature Specification 2: Unified Google Drive Backup Service (Manual + Periodic on Host Companion)

### 5.1 Architectural Recommendation & Rationale
Because a corruption-free Minecraft backup requires flushing world chunks (`save-all flush`) and **stopping the Minecraft JVM process completely** before reading region (`.mca`) and plugin SQLite/WAL files, **the backup procedure MUST execute in the 24/7 VPS Host Companion (`host-agent`), NEVER inside the Paper plugin (`agent`)**.
- If the plugin attempted to run the backup, shutting down the server would kill the plugin's own JVM mid-archive.
- The 24/7 Host Companion (`plexonpanel-host@<key>.service`) runs in an independent JVM outside the Minecraft process, retains its WebSocket connection to the VPS Relayer while Minecraft is offline, streams live byte-level archive/upload progress to the Vercel dashboard while the game server is stopped, and guarantees that `minecraft@<key>.service` is started back up even if Google Drive experiences an outage.

### 5.2 Restoring Periodic Scheduled Backups Alongside Manual Backups
In `PlexonPanel-main`, `FullRestorePointManager.java` and `RcloneBackupProvider.java` already implement the crash-safe cold backup and Google Drive promotion pipeline, but `STEP5_MANUAL_ONLY_BACKUP_MIGRATION.md` disabled scheduled backups in `MaintenanceSchedule.java` and `MaintenanceSettings.java`.
- **Required Changes in `host-agent`**:
  1. **Re-enable Scheduled Cold Backups in `MaintenanceSettings.java` & `MaintenanceSchedule.java`**:
     - Support two backup trigger modes in `host-config.json` and dynamic `maintenance.configure` settings:
       - **Manual On-Demand (`backup.create` / "Fully Backup Now")**: Operator selects a `30`, `15`, `10`, or `5`-minute player warning countdown (or immediate `0m` when `0` players are online).
       - **Periodic Scheduled Cold Backups (`schedule.backups`)**: Operator configures automated backup schedules with:
         - `enabled`: `boolean`
         - `cadence`: `"DAILY"` | `"WEEKLY"` | `"SELECTED_DAYS"` | `"INTERVAL_HOURS"` (e.g., every 6h, 12h, 24h, or specific weekdays + UTC/local time `HH:mm`)
         - `countdownMinutes`: `30` | `15` | `10` | `5`
         - `skipIfEmptySinceLastBackup`: `boolean` (optional optimization: if zero players have joined since the last verified Google Drive backup, skip the disruptive shutdown until a player session occurs or forced interval elapses).
  2. **Unified 14-Stage Cold Backup Execution Pipeline (`MaintenanceManager.java`)**:
     Both Manual and Scheduled triggers must execute the exact same fail-closed pipeline under the kernel node lock (`/run/plexonpanel/locks/<nodeId>.lock`):
     - `PREFLIGHT`: Verify `/usr/bin/rclone` executable, writable `/var/lib/plexonpanel/instances/<key>/provider/rclone.conf`, source size bounds (`backups.include`), local disk headroom, and bounded Google Drive connectivity test. If preflight fails before shutdown, abort and keep Minecraft online.
     - `COUNTDOWN`: Broadcast player warnings via loopback RCON (`127.0.0.1:25575`) at selected intervals (`30m`, `15m`, `10m`, `5m`, `1m`, `30s`, `15s`, `5s`). Persist countdown deadline in `MaintenanceStateStore.java` so browser refreshes never reset or cancel the timer.
     - `FINAL_SAVE`: Execute RCON `save-all flush` and require an affirmative response (`RconSaveFlushAffirmationTest` contract).
     - `STOPPING_SERVER` & `WAITING_FOR_STOP`: Stop `minecraft@<key>.service` via Polkit and prove `ActiveState=inactive` and `MainPID=0` (`SystemdService.stopped()`).
     - `ARCHIVING` & `HASHING` & `VERIFYING_LOCAL`: Stream `backups.include` (worlds, plugin configs/databases, server configs; rejecting symlinks and excluding `logs`, `cache`, `.cache`, `crash-reports`) into a staging `.partial` ZIP, `fsync`, promote to `restore-points/<backupId>.zip`, compute SHA-256, and validate the ZIP central directory (`LocalBackupVerifier.java`).
     - `UPLOADING_REMOTE` & `VERIFYING_REMOTE`: Invoke `/usr/bin/rclone` via fixed `ProcessBuilder` arrays to upload the ZIP and metadata to Google Drive staging, emit sanitized `bytesUploaded`, `totalBytes`, and `bytesPerSecond` progress events, promote to canonical remote paths, and verify that the remote Google Drive SHA-256 matches the local SHA-256.
     - `CLEANING_LOCAL`: Support configurable local retention policy (`REMOTE_ONLY_AFTER_VERIFY` removes the local VPS ZIP once Google Drive SHA-256 is verified to save VPS disk space, or `KEEP_LOCAL_ROTATING` retains the last $N$ archives locally alongside Google Drive rotation up to `retentionCount`).
     - `STARTING_SERVER` & `VERIFYING_STARTUP`: Unconditionally start `minecraft@<key>.service` whenever the backup workflow stopped it (even if Google Drive upload failed, marking the job `DEGRADED` with `retryUploadAvailable: true` so `backup.full.retry-upload` can re-upload the local verified ZIP later without shutting down Minecraft again).

## 6. Feature Specification 3: Performance Telemetry & Graph Upgrades

### 6.1 Backend Telemetry Enhancements (`PaperSnapshotCollector.java` & `ServiceResourceSampler.java`)
Preserve the 4 Hz (`server-interval-ticks: 5`) lightweight health cadence from Paper and 250 ms/1000 ms Host cgroup cadence while enriching the payload with additive Protocol 3 fields:
- **Tick Duration Percentiles & Histogram**: Alongside `tps` and average `mspt`, include `msptMin`, `msptP95`, `msptP99`, and `msptMax` over the last 100 ticks so the dashboard can plot real tick-spike envelopes rather than flat averages.
- **Strict Resource Scope Separation**: Keep the three resource producers explicitly tagged and never conflate them:
  1. `PAPER_JVM`: `heapUsedBytes`, `heapCommittedBytes`, `heapMaxBytes`, `gcCollectionCount`, `gcCollectionTimeMillis`, `processCpuPercent`.
  2. `MINECRAFT_SERVICE` (`SYSTEMD_CGROUP`): `cpuPercent` (`PERCENT_OF_ONE_CORE`, which legitimately exceeds `100%` on multi-core usage—never clamp at 100%), `memoryCurrentBytes`, `memoryMaxBytes`.
  3. `NODE` (`HOST_HARDWARE`): `nodeCpuPercent`, `nodeMemoryUsedBytes`, `nodeMemoryTotalBytes`, `loadAverage1m/5m/15m`, `diskFreeBytes`, `diskTotalBytes`, `networkRxBytesPerSec`, `networkTxBytesPerSec`.

### 6.2 Dashboard Graph Architecture (`PlexonPanel-Dashboard`)
Replace the single custom SVG chart (`src/components/charts/TimeSeries.tsx`) with a dedicated, high-performance charting layer (`src/components/charts/`) built with **uPlot** (or **Recharts** with memoized Canvas/SVG layers) designed for zero-jank 4 Hz updates:
1. **Multi-Horizon Time Selector & Brush Zoom**: Instant switching between `1m` (4 Hz raw), `5m`, `15m`, and `35m` (up to 8,192 raw points) plus click-and-drag brush zoom to inspect exact tick spikes.
2. **Dual-Band Tick Stability Chart (TPS + MSPT p95/p99 Envelope)**:
   - Primary area/line for `MSPT (avg)` with a shaded confidence band showing `msptP95` to `msptP99`, plus a `50.0 ms` (20 TPS threshold) reference rule.
   - Synchronized crosshair across all visible charts on the `Overview` and `Performance` pages.
3. **Three-Tier Memory & CPU Attribution Chart**:
   - Visualizes `JVM Heap Used` vs. `JVM Heap Committed` vs. `systemd cgroup MemoryCurrent` vs. `VPS Node Memory` on clearly differentiated tracks so operators immediately see native/off-heap memory pressure prior to an OOM kill.
4. **Event & GC Pause Annotations**:
   - Overlay vertical markers on the timeline for **GC pauses**, **Player Join/Leave bursts** (from the VPS presence feed), and **Plugin reloads / Maintenance warnings** so operators can correlate MSPT spikes directly with in-game causes.
5. **Strict Data Truth Rules**:
   - Preserve source epoch boundaries (`src/presentation/epochs.ts`): when a server restarts (`session.epoch_reset`) or disconnects, render an explicit **disconnected/restart gap** in the chart—never interpolate a line across offline periods.
   - Keep independent source clocks (`Paper` vs. `Host`) and freshness badges (`Live ≤10s`, `Delayed 10–30s`, `Stale >30s`, `Clock Skew >+5s`).

## 7. Feature Specification 4: Complete UI/UX Redesign (Next.js + Tailwind CSS + shadcn/ui)

### 7.1 Target Tech Stack & Project Structure
Migrate `PlexonPanel-Dashboard` from Vite + monolithic CSS to a clean, modular **Next.js App Router** architecture optimized for static/edge deployment on **Vercel**:
- **Framework**: Next.js 15+ (App Router, `output: "export"` or Vercel hybrid with strict CSP headers in `next.config.mjs` / `vercel.json`), React 19, TypeScript.
- **Styling & Primitives**: Tailwind CSS + `shadcn/ui` (Radix UI Dialog, DropdownMenu, Tabs, Tooltip, Command Palette `cmdk`, Switch, Select, Toast/Sonner) + `lucide-react` icons.
- **Typography**: Self-hosted `@fontsource-variable/manrope` (UI & headings) and `@fontsource-variable/jetbrains-mono` (`tabular-nums` for all metrics, UUIDs, timestamps, and console logs).
- **Virtualization**: `@tanstack/react-virtual` for the Console, Player Roster, and Audit Trail tables to guarantee `<16ms` frame times even at 2,500 live console rows.

```text
PlexonPanel-Dashboard/
├── src/
│   ├── app/                          # Next.js App Router shell & route segments
│   │   ├── layout.tsx                # Fonts, ThemeProvider, SessionStoreProvider, ActionReviewModal
│   │   ├── page.tsx                  # Entry gate (Splash 2.8s -> PairingGate OR Dashboard Workspace)
│   │   └── (workspace)/              # Authenticated operational shell
│   │       ├── fleet/page.tsx        # R01: Multi-server Fleet & Shared Node Ledger
│   │       ├── overview/page.tsx     # R02: Real-time Command Deck (Charts + Live Console + Presence)
│   │       ├── performance/page.tsx  # R03: Deep Telemetry & 8-Track Synchronized Analyzer
│   │       ├── players/page.tsx      # R04: Live Roster, Session JSON Timeline & Exact-UUID Drawer
│   │       ├── console/page.tsx      # R05: Virtualized VPS SQLite Terminal, Chat & Plugin Inventory
│   │       ├── backups/page.tsx      # R06: Google Drive Cold Backup Center (Manual + Scheduled)
│   │       ├── access/page.tsx       # R07: Paired Devices, Scope Matrix & Dual-Agent Audit Trail
│   │       └── settings/page.tsx     # R08: Appearance, Relay/OTP Pairing, Privacy & Diagnostics
│   ├── adapter/                      # Preserved & updated Protocol 3 client, Ed25519/HMAC, freshness
│   ├── store/                        # External store, preferences (8 locked keys), selector hooks
│   ├── presentation/                 # Epochs, telemetry projections, authority & review-policy
│   ├── features/                     # ActionReview modal controller & capability gates
│   └── components/
│       ├── ui/                       # shadcn/ui Tailwind primitives
│       ├── shell/                    # Top Command Bar, Server Switcher, Source Freshness Ribbon, Cmd+K
│       ├── charts/                   # Synchronized uPlot/Recharts telemetry canvases
│       └── terminal/                 # Dynamic-height virtualized SQLite console viewer
```

### 7.2 Aesthetic Direction & Layout System ("Obsidian Telemetry Workbench")
Design a crisp, high-craft technical interface inspired by Vercel, Linear, and Grafana Dark:
- **Color Palette (Dark Default + High-Contrast Light Mode)**:
  - Dark surfaces: Background `#090D10`, Primary Card `#11171C`, Raised Surface `#172026`, Inset Terminal/Chart `#06090B`, Hairline Borders `#222F38`.
  - Semantic accents: Primary Emerald/Teal `#10B981` / `#2DD4BF`, Info Cyan `#38BDF8`, Warning Amber `#F59E0B`, Danger Rose `#F43F5E`, Secondary Violet `#A78BFA`.
- **Navigation & Workspace Chrome**:
  - Replace the wide 240px left sidebar with a **two-tier top command header** (56px global bar with Server Switcher, Live Transport/Source Freshness Ribbon, `Cmd+K` Command Palette trigger, and Boot Epoch uptime badge + 44px horizontal route bar with keyboard shortcuts `G` then `1–8`).
  - On viewports `<1024px`, collapse route navigation into an accessible Radix Sheet/Drawer with 44px touch targets.

### 7.3 Route-by-Route Functional & UX Requirements
1. **R01 — Fleet (`/fleet`)**:
   - Displays all paired servers (up to 16 simultaneous passive feeds + 1 active control connection) grouped by verified `nodeId`.
   - Deduplicates shared VPS node hardware metrics (`NODE` CPU, RAM, Disk) per `nodeId` while showing per-instance Paper TPS/MSPT, player count, systemd service status, and current `bootEpochId`.
2. **R02 — Overview (`/overview`)**:
   - **Row 1 (Hero Telemetry + Terminal Split, 7:5 ratio)**: Left panel renders the real-time Dual-Band TPS/MSPT + Memory chart; Right panel renders a live tail of the VPS SQLite console + recent Player Join/Leave pills from `player-events-current.json`.
   - **Row 2 (KPI Strip & Lifecycle Controls)**: 4 compact metric cards (`TPS / MSPT p95`, `Online Players / Capacity`, `Service cgroup CPU & Memory`, `Google Drive Backup Status`) alongside fail-closed `Start`, `Stop`, and `Restart` buttons gated by `session.reason`.
   - **Row 3 (Worlds & Active Roster Preview)**: Per-world loaded chunks, entities, and tile entities alongside active player heads.
3. **R03 — Performance (`/performance`)**:
   - Interactive 8-signal telemetry studio (`TPS`, `MSPT Avg/p95/p99`, `JVM Heap`, `Service cgroup Memory`, `Service CPU %`, `Node CPU %`, `Loaded Chunks`, `Entities`) with Single-Focus and Multi-Track Synchronized Compare modes, GC pause markers, and an inspectable 50-sample raw evidence table.
4. **R04 — Players (`/players`)**:
   - Live searchable roster + **Current Boot Session Join/Leave Timeline** powered by the Host's `player-events-current.json` and SQLite `player_presence_events`.
   - Clicking a player opens an **Exact-UUID Inspector Sheet/Panel** (binding all moderation/operator actions—`kick`, `ban`, `whitelist`, `gamemode`, `heal`, `feed`, `op/deop`, `message`, and LuckPerms/command builders—strictly to that player's immutable `uuid` so a player disconnecting never retargets another player).
5. **R05 — Console & Chat (`/console`)**:
   - **Zero-Web-Cache Virtualized Terminal**: Powered by `@tanstack/react-virtual` with dynamic `ResizeObserver` row measurement. Streams live lines and cursor-paginates older lines directly from the VPS Host SQLite `console_logs` table (`console.history` / `console.history.errors`).
   - Includes a prominent **Boot Session Badge** showing when the log table was last refreshed (e.g., *"Session `a8f3...` · Started 2h 14m ago — auto-refreshes on server restart"*), severity filter pills (`DEBUG`, `INFO`, `WARN`, `ERROR`), server-side + client-side search, `Follow Live` lock indicator, and reviewed Paper command execution bar (`console.execute`).
   - Separate tabs for **Live Chat** (with MiniMessage toggle gated by `chat.send.minimessage`) and **Plugin Inventory** (with safe allowlisted plugin reload).
6. **R06 — Backups (`/backups`)**:
   - **Top Priority Banner**: Active durable job progress (`QUEUED` → `PREFLIGHT` → `COUNTDOWN` → `FINAL_SAVE` → `STOPPING_SERVER` → `ARCHIVING` → `VERIFYING_LOCAL` → `UPLOADING_REMOTE` with live MB/s speed and byte progress → `VERIFYING_REMOTE` → `STARTING_SERVER` → `COMPLETED` / `DEGRADED`) or recovery alert (`RECOVERY_REQUIRED`).
   - **Manual & Periodic Schedule Control Cards**:
     - **Manual Full Backup Card**: Run `backup.preflight` (displaying granular checks for rclone binary, Google Drive config, source size, and VPS disk headroom), choose `30m`, `15m`, `10m`, or `5m` countdown, and trigger **Fully Backup Now** via `ActionReview`.
     - **Periodic Google Drive Schedule Card**: Configure automated cold backup cadence (`Daily`, `Weekly`, `Selected Days`, or `Interval`), target time, and countdown preset (`maintenance.configure`).
   - **Restore Point Inventory Table**: Lists verified Google Drive and local archives with SHA-256 digests, sizes, verification badges (`VERIFIED_REMOTE` vs. `VERIFIED_LOCAL`), **Retry Upload** button (`backup.full.retry-upload` when Drive was degraded), `Verify`, and `Delete`.
7. **R07 — Access & Audit (`/access`)**:
   - **Your Authority Matrix**: Searchable table of all canonical scopes showing `Device Grant` vs. `Paper Capability` vs. `Host Capability` and the exact plain-English reason if an action is disabled.
   - **Paired Devices**: Lists paired browsers (from Paper + Host mirror) with role, creation/expiry timestamps, last active minute, and reviewed `Revoke` (`devices.revoke`, protecting the currently active browser from accidental self-revocation).
   - **Audit Trail**: Dual-source (`Paper` and `Host`) operation trail (`audit.view` / `audit.view.self`).
8. **R08 — Settings (`/settings`)**:
   - Preserves all 8 preference keys in `plexon:preferences` (`theme`, `density`, `textSize`, `accent`, `motion`, `chartFill`, `timezone`, `skinProvider`), Relay URL & OTP Pairing manager, and redacted JSON diagnostic bundle export.

## 8. Non-Negotiable Safety & Verification Guardrails

1. **No Fabrication of Telemetry or Status**:
   - Missing ≠ `0`. Service stopped ≠ Paper offline ≠ Host offline ≠ Relay disconnected. Unknown progress ≠ `0%`. Transport queue receipt (`dashboard.action_queued`) ≠ operation completion.
2. **Preserve Cryptographic & Origin Isolation**:
   - Never move bearer credentials out of IndexedDB (`plexonpanel-browser-v3`) into `localStorage`, cookies, URL query strings, or diagnostic exports.
   - Never render console lines, chat messages, player names, or audit reasons using `dangerouslySetInnerHTML`. Keep `src/lib/textFormat/index.ts` rendering strictly as inert React text segments.
3. **Host Read-Only & Command Confinement**:
   - The Host Companion (`host-agent`) must never write to `serverRoot`, follow symlinks during backup archiving, accept browser-supplied `rclone` paths/flags, or accept browser-supplied `systemd` unit names or `journalctl` flags.

## 9. Phased Execution Roadmap for GPT-6.1 Sol

Execute the transformation in four deterministic phases:

### Phase 1 — Backend Upgrades in `PlexonPanel` (`host-agent` & `agent`)
- Add `org.xerial:sqlite-jdbc` to `host-agent/build.gradle.kts`.
- Implement `HostSessionStore.java` (SQLite WAL mode `session-telemetry.sqlite` + atomic `player-events-current.json` writer) in `host-agent`.
- Hook `SystemdService.java` / `HostMain.java` lifecycle transitions so every server restart or shutdown-then-start cycle increments/rotates the active `bootEpochId`, clears/archives prior-session SQLite tables, resets `player-events-current.json`, and broadcasts `session.epoch_reset`.
- Route live console capture (`HostConsoleStreamService.java`), player join/leave events (`players.presence`), and lifecycle events into `HostSessionStore`, and update `HostConsoleHistory.java` to serve paginated queries from SQLite.
- Update `MaintenanceSettings.java`, `MaintenanceSchedule.java`, and `MaintenanceManager.java` to support both **Manual** and **Periodic Scheduled** cold backups to Google Drive via `/usr/bin/rclone`.
- Run `./gradlew test check` to verify all Java 25 unit and contract tests pass.

### Phase 2 — Next.js + Tailwind CSS + Adapter Migration in `PlexonPanel-Dashboard`
- Initialize the Next.js (App Router, React 19, TypeScript) + Tailwind CSS + `shadcn/ui` workspace while preserving `src/adapter/*`, `src/presentation/{authority,epochs,review-policy,telemetry}.ts`, `src/features/capabilities.ts`, `src/lib/*`, and `src/store/preferences.ts`.
- Strip `consoleLines` and `chatMessages` persistence from `src/adapter/browser-store.ts` and `src/adapter/control-state.ts` so zero console/chat data is stored in browser web cache.
- Wire the new `session.epoch_reset` event handler and `events.session.list` hydration into `src/adapter/data-source.ts` and `src/adapter/control-state.ts`.

### Phase 3 — Build the 8 New Dashboard Routes & High-Density Telemetry Charts
- Build the **Obsidian Telemetry Workbench** shell (`TopCommandBar`, `RouteBand`, `ServerSwitcher`, `SourceFreshnessRibbon`, `ActionReviewModal`, `PairingGate`).
- Build the synchronized multi-track `uPlot` / `Recharts` telemetry suite (`TPS/MSPT p95-p99 envelope`, `JVM vs. cgroup vs. Node Memory`, `CPU Attribution`, and `Event/GC Markers`).
- Implement all 8 routes (`/fleet`, `/overview`, `/performance`, `/players`, `/console`, `/backups`, `/access`, `/settings`) including the `@tanstack/react-virtual` SQLite console terminal, the `.json` + SQLite player join/leave session timeline, and the unified Manual + Scheduled Google Drive backup studio.

### Phase 4 — End-to-End Verification & Release Packaging
- Run TypeScript verification (`tsc --noEmit`), adapter/contract test suites (`node --import tsx --test tests/*.test.ts`), Next.js production build (`next build`), and Playwright visual/accessibility checks across Desktop (`1440x900`) and Mobile (`390x844`) in both Dark and Light themes.
- Deliver the complete diff, updated `vercel.json` / `next.config.mjs` CSP configuration, and release verification summary.
