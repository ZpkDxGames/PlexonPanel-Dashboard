# 6.0 presentation module inventory

Source 86b6a0cefb2c5e420c9c862a7897705e1ea59146. Canonical workspace props are in UI_6_BASELINE.md; this exact module/function/import index covers all29 TSX modules, including shared primitives.

## app/activity/page.tsx

Imports: `../../components/select`, `next/link`, `react`, `../../components/player-head`, `../../lib/activity-history`, `./activity.module.css`.

- `dayLabel` (line21): `iso: string`
- `eventTime` (line36): `event: PresenceHistoryEvent`
- `useServerHistory` (line44): `serverId: string`
- `ActivityPage` (line59): ``

## app/activity-history-modal.tsx

Imports: `../components/select`, `react`, `../lib/data-source`, `../lib/durable-activity`, `./control-views`.

- `ActivityHistoryModal` (line25): `{ props, open, onClose, }: { props: ViewProps; open: boolean; onClose: () => void; }`
- `navigate` (line124): `index: number ; cursor: string`

## app/advanced-views.tsx

Imports: `../components/select`, `react`, `../lib/data-source`, `../lib/control-state`, `./control-views`.

- `downloadTransfer` (line17): `action: "files.download" | "backup.download" ; parameters: JsonMap ; filename: string ; kind: "PAPER" | "HOST" ; signal: AbortSignal ; progress: (n: number) => void ; serverId: string`
- `FilesView` (line95): `props: ViewProps`
- `fuzzy` (line629): `name: string ; query: string`
- `Syntax` (line634): `{ content }: { content: string }`

## app/backup-destination.tsx

Imports: `./control-views`, `../lib/fleet-contract`.

- `BackupDestination` (line4): `{ state, remote, configured, restartRequired }: { state: ViewProps["state"]; remote: string; configured: boolean; restartRequired: boolean; }`

## app/backups-view.tsx

Imports: `../components/select`, `./backup-destination`, `../lib/backup-readiness`, `react`, `../lib/data-source`, `../lib/control-state`, `./control-views`.

- `parseSchedule` (line103): `value: unknown ; fallback: ScheduleDraft`
- `parseSettings` (line116): `value: unknown`
- `isCountdownSeconds` (line155): `value: number`
- `countdownLabel` (line159): `seconds: number`
- `countdownWarnings` (line163): `seconds: CountdownSeconds`
- `countdownWarningLabel` (line169): `seconds: CountdownSeconds`
- `restartCountdown` (line175): `value: number[]`
- `ScheduleEditor` (line180): `{ value, onChange, }: { value: ScheduleDraft; onChange: (value: ScheduleDraft) => void; }`
- `readinessTone` (line275): `state: ReadinessState`
- `ReadinessItem` (line282): `{ label, state, detail, }: { label: string; state: ReadinessState; detail: string; }`
- `queryAlert` (line302): `title: string ; query: { error: string; hasSuccess: boolean; updatedAt: number }`
- `listStrings` (line317): `value: unknown ; limit = 16`
- `booleanState` (line323): `value: unknown`
- `phaseLabel` (line327): `phase: string`
- `formatCountdown` (line334): `value: number | null`
- `BackupsView` (line341): `props: ViewProps`

## app/client-preferences.tsx

Imports: `../components/select`, `./control-views`, `../components/ui-preferences-provider`, `../lib/display-cadence`.

- `SelectField` (line8): `{ label, value, options, onChange, hint, }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; hint?: string; }`
- `ToggleField` (line44): `{ label, checked, onChange, hint, disabled = false, }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string; disabled?: boolean; }`
- `ClientPreferences` (line73): ``

## app/communication-views.tsx

Imports: `../components/select`, `react`, `./control-views`, `../lib/control-state`.

- `lower` (line19): `value: unknown`
- `Timestamp` (line23): `{ value }: { value: unknown }`
- `HistoryPlayerDrawer` (line34): `{ entry, entries, close, }: { entry: JsonMap; entries: JsonMap[]; close: () => void; }`
- `ChatView` (line116): `props: ViewProps`
- `PluginsView` (line283): `props: ViewProps`
- `PluginDialog21` (line429): `{ plugin, close, ...props }: ViewProps & { plugin: JsonMap; close: () => void }`

## app/configuration-view.tsx

Imports: `./advanced-views`, `./control-views`, `../lib/control-state`.

- `ConfigurationView` (line15): `props: ViewProps`

## app/connection-summary.tsx

Imports: `../lib/control-state`, `../lib/connection-state`, `../lib/telemetry-clock`.

- `useConnectionState` (line6): `state: ControlState ; phase: ConnectionPhase`
- `ConnectionPills` (line10): `{ state, phase }: { state: ControlState; phase: ConnectionPhase }`
- `ConnectionSummary` (line18): `{ state, phase, retry }: { state: ControlState; phase: ConnectionPhase; retry: () => void }`

## app/console-view.tsx

Imports: `react`, `./control-views`, `../lib/control-state`.

- `downloadText` (line10): `filename: string ; body: string`
- `atConsoleTail` (line22): `element: HTMLDivElement`
- `stableLineId` (line26): `line: JsonMap`
- `lineKey` (line37): `line: JsonMap ; index: number`
- `mergeConsoleLines` (line41): `history: JsonMap[] ; live: JsonMap[]`
- `consoleSourceLabel` (line54): `props: ViewProps`
- `ConsoleView` (line71): `props: ViewProps`

## app/control-plane-build-panel.tsx

Imports: `react`, `../lib/build-identity`, `./control-views`.

- `shortCommit` (line13): `value: string | undefined`
- `shortContract` (line17): `value: string | undefined`
- `buildTime` (line23): `value: string | undefined`
- `ControlPlaneBuildPanel` (line28): `{ paperVersion, hostVersion, }: { paperVersion?: string | null; hostVersion?: string | null; }`

## app/control-views.tsx

Imports: `react`, `../lib/data-source`, `../lib/control-state`, `../lib/device-grant`.

- `bytes` (line26): `value: unknown`
- `metric` (line33): `value: unknown ; suffix = "" ; digits = 1`
- `time` (line37): `value: unknown`
- `duration` (line44): `value: unknown`
- `Badge` (line52): `{ children, tone = "quiet", }: { children: React.ReactNode; tone?: string; }`
- `Panel` (line61): `{ title, aside, children, className = "", }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string; }`
- `Empty` (line82): `{ title, children, }: { title: string; children?: React.ReactNode; }`
- `ActionButton` (line99): `{ children, onClick, danger = false, disabled = false, }: { children: React.ReactNode; onClick: () => Promise<unknown>; danger?: boolean; disabled?: boolean; }`
- `useQuery` (line126): `action: string ; parameters: JsonMap ; enabled: boolean ; kind?: "PAPER" | "HOST"`
- `ratio` (line186): `a: unknown ; b: unknown`
- `Agent` (line191): `{ name, online, detail, }: { name: string; online: boolean; detail: string; }`

## app/dashboard.tsx

Imports: `../components/select`, `next/dynamic`, `react`, `../lib/data-source`, `../lib/browser-store`, `../lib/control-state`, `../lib/dashboard-version`, `../lib/display-cadence`, `../lib/device-grant`, `../lib/scopes`, `../lib/lifecycle-state`, `../lib/operation-messages`, `../components/ui-preferences-provider`, `./control-views`, `./communication-views`, `./overview-view`, `./connection-summary`, `./telemetry-freshness`.

- `actionAuthority` (line119): `action: string ; ready: Ready | null ; requested?: "PAPER" | "HOST"`
- `Icon` (line191): `{ name, size = 18 }: { name: IconName; size?: number }`
- `Brand` (line209): `{ compact = false }: { compact?: boolean }`
- `Pairing` (line227): `{ done, cancel, servers = [], selectServer, error: initialError, }: { done: () => Promise<void>; cancel?: () => void; servers?: readonly RelayCredential[]; selectServer?: (id: string) => void; error?: string; }`
- `Confirm` (line359): `{ value }: { value: Confirmation }`
- `CommandPalette` (line410): `{ open, close, navigate, run, restartAvailable, refresh, copyDiagnostics, }: { open: boolean; close: () => void; navigate: (section: Section) => void; run: ViewProps["run"]; restartAvailable: boolean; refresh: () => void; copyDiagnostics: () => void; }`
- `Dashboard` (line494): ``

## app/fleet-overview.tsx

Imports: `react`, `../lib/browser-store`, `../lib/control-state`, `../lib/fleet-feed`, `../lib/connection-state`, `../lib/fleet-model`, `../lib/telemetry-clock`.

- `bytes` (line10): `value: number | null`
- `metric` (line13): `value: number | null ; unit = ""`
- `FleetOverview` (line16): `{ credentials, selected, connected, openServer, pair, labels = {}, rememberName, phase }: { credentials: readonly RelayCredential[]; selected: ControlState; connected: boolean; openServer: (id: string) => void; pair: () => void; labels?: Record<string, string>; rememberName?: (id: string, name: string) => void; phase?: ConnectionPhase; }`

## app/governance-views.tsx

Imports: `../components/select`, `react`, `./control-views`, `../lib/control-state`, `../lib/scopes`.

- `metricDuration` (line18): `value: unknown`
- `expired` (line23): `value: unknown`
- `outcomeTone` (line28): `value: unknown`
- `AuditView` (line38): `props: ViewProps`
- `localCapability` (line348): `scope: Scope ; paper: Record<string, boolean> ; host: Record<string, boolean>`
- `AccessView` (line356): `props: ViewProps & { forget: () => Promise<void>; pair: () => void }`
- `DeviceDialog21` (line624): `{ device, currentDeviceId, close, }: { device: JsonMap; currentDeviceId?: string; close: () => void; }`

## app/layout.tsx

Imports: `next`, `next/script`, `./dashboard.css`, `../components/ui-preferences-provider`.

- `RootLayout` (line15): `{ children, }: Readonly<{ children: React.ReactNode; }>`

## app/overview-view.tsx

Imports: `react`, `./control-views`, `./activity-history-modal`, `./telemetry-chart`, `../lib/control-state`, `../lib/metric-reports`, `../lib/chart-geometry`, `../lib/telemetry-freshness`, `../lib/telemetry-clock`, `../lib/fleet-model`, `../components/ui-preferences-provider`.

- `MetricTile` (line14): `{ label, value, detail, history, field, now, fresh }: { label: string; value: string; detail: string; history: Sample[]; field: MetricField; now: number; fresh: boolean; }`
- `OverviewView` (line33): `props: ViewProps`

## app/page.tsx

Imports: `./dashboard`.

- `Home` (line3): ``

## app/performance-view.tsx

Imports: `react`, `./control-views`, `../lib/control-state`, `../components/ui-preferences-provider`, `../lib/metric-reports`, `../lib/telemetry-clock`, `./telemetry-chart`, `../lib/telemetry-freshness`.

- `displayTime` (line31): `at: number ; zone: "local" | "utc"`
- `capturedAt` (line38): `recordValue: JsonMap`
- `downloadBlob` (line44): `filename: string ; body: string ; type: string`
- `exportHistory` (line56): `history: Sample[] ; serverId: string ; minutes: number ; format: "csv" | "json"`
- `SegmentedWindow` (line61): `{ value, onChange }: { value: number; onChange: (value: 1 | 5 | 15 | 30) => void }`
- `WorldTable` (line71): `{ worlds }: { worlds: Record<string, unknown>[] }`
- `PerformanceView` (line81): `{ props, resetHistory }: { props: ViewProps; resetHistory: () => void }`

## app/player-roster.tsx

Imports: `../components/select`, `react`, `./control-views`, `../lib/control-state`, `../lib/data-source`, `../components/player-head`, `../components/ui-preferences-provider`, `./communication-views`.

- `lower` (line24): `value: unknown`
- `playerNames` (line28): `player: JsonMap`
- `Timestamp` (line38): `{ value }: { value: unknown }`
- `displayedUuid` (line49): `uuid: string ; preference: "hidden" | "short" | "full"`
- `useMobileLayout` (line57): ``
- `PlayerRoster` (line69): `props: ViewProps & { showHistoryTab?: boolean }`
- `PlayerDrawer23` (line361): `{ player, previousSessions, historyAvailable, close, ...props }: ViewProps & { player: JsonMap; previousSessions: JsonMap[]; historyAvailable: boolean; close: () => void; }`

## app/players-view.tsx

Imports: `react`, `../lib/durable-activity`, `./control-views`, `./activity-history-modal`, `./player-roster`.

- `journalStatus` (line9): `props: ViewProps`
- `PlayersView` (line24): `props: ViewProps`

## app/preferences-dialog.tsx

Imports: `react`, `./client-preferences`.

- `PreferencesDialog` (line5): `{ close }: { close: () => void }`

## app/server-view.tsx

Imports: `react`, `./control-views`, `../lib/control-state`, `../lib/dashboard-version`, `../lib/operation-messages`, `../lib/lifecycle-state`.

- `stateTone` (line28): `state: ServiceState`
- `OperationTimeline` (line35): `{ pending }: { pending: PendingOperation }`
- `ServerView` (line70): `props: ViewProps`

## app/settings-view.tsx

Imports: `./control-views`, `../lib/control-state`, `../lib/dashboard-version`, `../components/ui-preferences-provider`, `./control-plane-build-panel`, `./client-preferences`.

- `SettingsView` (line9): `props: ViewProps & { reconnect: () => void }`

## app/telemetry-chart.tsx

Imports: `react`, `./control-views`, `../lib/control-state`, `../lib/display-cadence`, `../lib/chart-geometry`, `../lib/metric-reports`, `../lib/telemetry-clock`, `../components/ui-preferences-provider`.

- `displayTime` (line24): `at: number ; zone: "local" | "utc"`
- `sampleFreshnessText` (line27): `at: number ; tailAt: number`
- `sourceAgeText` (line34): `capturedAt: number | null`
- `trendText` (line42): `points: readonly TimedValue[]`
- `TelemetryChart` (line52): `{ history, spec, windowMinutes, status, capacity, sourceLabel, sourceIntervalMs, sourceCapturedAt, }: { history: Sample[]; spec: ChartSpec; windowMinutes: number; status: "live" | "paused" | "disconnected" | "stale"; capacity?: number | null; sourceLabel: string; sourceIntervalMs: number | null; sourceCapturedAt: number | null; }`

## app/telemetry-freshness.tsx

Imports: `../lib/control-state`, `../lib/connection-state`, `../lib/telemetry-freshness`, `../lib/telemetry-clock`.

- `TelemetryFreshness` (line7): `{ state, phase }: { state: ControlState; phase: ConnectionPhase }`

## components/player-head.tsx

Imports: `react`, `../lib/avatar-provider`, `./ui-preferences-provider`.

- `clearPlayerHeadSessionCache` (line11): ``
- `AvatarImage` (line12): `{ url, size, motion }: { url: string; size: PlayerHeadSize; motion: boolean }`
- `PlayerHead` (line26): `{ uuid, name, skinTextureId, size, online = true }: { uuid: string; name: string; skinTextureId?: string; size: PlayerHeadSize; online?: boolean; }`

## components/select.tsx

Imports: `react`, `react-dom`, `./select.module.css`.

- `textContent` (line9): `value: ReactNode`
- `optionsFrom` (line13): `children: ReactNode`
- `Select` (line24): `{ value, children, onValueChange, disabled = false, className = "", id, name, title, "aria-label": label, "aria-labelledby": labelledBy, "aria-describedby": describedBy, }: { value?: string | number; children: ReactNode; onValueChange: (value: string) => void; disabled?: boolean; className?: string; id?: string; name?: string; title?: string; "aria-label"?: string; "aria-labelledby"?: string; "aria-describedby"?: string }`

## components/ui-preferences-provider.tsx

Imports: `react`, `../lib/ui-preferences`, `../lib/avatar-provider`.

- `systemState` (line59): ``
- `applyPresentation` (line71): `preferences: UiPreferencesV1 ; resolved: ResolvedUiPresentation`
- `resolveProviderState` (line89): ``
- `UiPreferencesProvider` (line109): `{ children }: { children: ReactNode }`
- `useUiPreferences` (line200): ``

