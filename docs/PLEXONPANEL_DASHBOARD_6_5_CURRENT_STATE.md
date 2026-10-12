# PlexonPanel Dashboard 6.5.0 — current state and operating guide

This document describes the dashboard exactly as it exists in the 6.5.0 release. It is both an operator guide and the authoritative starting point for future dashboard work.

## 1. Release snapshot

- Stack: React 19, Vite 8, TypeScript, project-owned SVG charts and Motion.
- Protocol: PlexonPanel Dashboard protocol 3.
- Interface: light glass is the primary visual theme, with a complete dark variant.
- Navigation: eleven lazy-loaded routes.
- Authority: one effective-authority resolver; a verified Owner receives all 54 scopes known by the negotiated dashboard contract.
- Deployment branch: [`revamp/6.5.0`](https://github.com/ZpkDxGames/PlexonPanel-Dashboard/tree/revamp/6.5.0).
- Production: [plexon-panel-dashboard.vercel.app](https://plexon-panel-dashboard.vercel.app).
- Files and standalone Plugins pages are intentionally absent. The original Plugins tab inside Console remains.
- Demo data exists only in development and review builds. Production never invents server data.

## 2. First connection and pairing

The dashboard stores pairing credentials in the current browser. They are bound to the server and relay that issued them.

1. Open the dashboard.
2. If no pairing exists, enter the public HTTPS relay origin when requested.
3. Enter a recognizable device name, such as `Operations desktop`.
4. Generate a one-time pairing code through the PlexonPanel server-side pairing flow.
5. Enter the code and choose **Pair server**.
6. Wait for the signed server session to become live.

Only the public relay origin belongs in the frontend. Never enter or expose Cloudflare credentials, pairing peppers, signing keys or server secrets.

Additional servers can be paired from **Settings → Pair another server**. Use **Fleet** or the persistent server selector to switch instances. Server state, telemetry, console history and locally selected icons remain isolated by server ID.

### Connection states

The dashboard distinguishes these conditions instead of presenting stale values as live:

- Relay connected and Paper/Host available.
- Minecraft stopped while Host remains available.
- Paper unavailable or reconnecting.
- Host unavailable.
- Relay unavailable or configuration required.
- Data present but stale.
- No sample received yet.
- Explicit zero measurement.

Use **Settings → Relay connection** to change the public origin or reconnect. Stored pairings are retained if a relay mismatch or temporary outage occurs.

## 3. Current navigation

| Page | Current purpose |
| --- | --- |
| Overview | Server status, lifecycle controls, KPIs, recent telemetry, world summary and compact console activity. |
| Console | Live console, commands, Chat and the retained Plugins tab. |
| Players | Online roster, player details, moderation actions, permissions and skin heads. |
| Performance | Tick, JVM, Host and retained time-series analysis. |
| Worlds | World and dimension telemetry using currently supplied server measurements. |
| Backups | Host preflight, restore-point creation, operation state and available backup inventory. |
| Schedules | Existing maintenance policy, scheduled restart controls and schedule preview. |
| Activity | Focused join/leave, world-generation and backup-critical events. This route still uses the `#Logs` hash internally. |
| Fleet | All paired servers, source health and server switching. |
| Access & audit | Paired devices, effective permissions, device revocation and recent server operations. |
| Settings | Relay, pairing, presentation, graphs, skins, server icon and diagnostics. |

The command palette opens with `Ctrl+K` or `Cmd+K`. It searches pages and currently visible players. `Escape` closes palettes, drawers and notification surfaces.

## 4. Overview and lifecycle controls

Overview is the primary operational page. It reports data only when the corresponding source is current.

- Paper supplies Minecraft health, players, TPS, MSPT, JVM and world information.
- Host supplies service and machine information where its existing contract provides it.
- A stopped Minecraft service can still be managed when Host is live and its service evidence is current.
- Start, Stop and Restart remain signed server actions and are never simulated locally.

Stop and Restart use one review dialog. After review, the dashboard sends `confirmed: true`, as required by the agent contract. The dialog is not followed by a second redundant typed confirmation. The server or relay remains authoritative and can still reject an operation.

Do not retry an operation blindly if the selected server, agent generation or connection changes while it is in progress. Check the resulting status and **Access & audit** first.

## 5. Console operation

### Output controls

Console supports:

- Search and level/category filtering.
- Grouped repeated lines and expandable stack traces.
- Pause/resume without discarding the retained stream.
- Line wrapping, timestamps and thread/source presentation.
- Export of the currently filtered output.
- Clear with the existing local recovery behavior.
- Virtualized rendering for high-volume output.

The client retains at most 2,500 console entries and renders only the visible rows. Server-provided formatted content is parsed as inert text and bounded formatting segments; it is never inserted as executable HTML.

### Sending commands

1. Open **Console** and place the cursor in **Server command**.
2. Type a command with or without a leading slash.
3. Press `Enter` or use the send button.
4. Safe commands dispatch directly through the capable action agent.
5. High-risk commands open a typed confirmation review before dispatch.

The command input prefers a capable Paper action target even if Host supplies the visible journal stream. It falls back only when the negotiated authority and capabilities permit it.

Useful input behavior:

- `Tab`: complete a matching known command.
- `Arrow Up` / `Arrow Down`: browse history.
- `Escape`: leave history browsing and restore the unfinished draft.
- `Ctrl+R` / `Cmd+R`: recall the first history entry containing the current text.

### Command history

History is browser-local and stored separately for each server.

- A command is stored after dispatch returns a completion; cancelled reviews are not stored.
- Commands are normalized, deduplicated and limited to 200 entries per server.
- Open **History** to recall an entry without executing it.
- Use the × control to remove one entry.
- Use **Clear all** to erase history for the selected server.
- Switching servers loads that server's own history.

The current unfinished input is preserved while browsing older entries.

### Chat and Plugins tabs

- **Chat** shows the retained global chat stream and uses the existing signed chat action for sending messages.
- **Plugins** is the original Console inventory/action surface. There is deliberately no separate Plugins route.
- Availability depends on the connected Paper agent, advertised capabilities and the signed device grant.

## 6. Telemetry and charts

Overview, Performance and Fleet use fixed requested time windows rather than stretching the plot around whatever data has arrived.

Current chart behavior:

- Stable plot geometry during streaming updates.
- Bounded Y-axis hysteresis that can recover after an old spike leaves the window.
- Richer width-aware sample density.
- Independent hover and inspection for every chart.
- Inspection snaps to received samples.
- Current-value legends and source/freshness labels.
- Tooltip and crosshair containment on narrow viewports.
- Smooth, straight and stepped line options.
- Area and line formats.
- Rich and compact detail modes.

Interpolation is visual geometry only. It does not create measurements. Missing, stale, unavailable and zero values remain distinct.

Retained in-browser chart history is bounded to approximately 35 minutes. Longer history requires a server-side history endpoint or metrics store.

### Display update rate

Settings offers local presentation buffering of:

- 50 ms
- 100 ms — recommended default
- 250 ms
- 500 ms
- 1000 ms

This changes how frequently received state is presented. It does not change the server capture rate or create extra telemetry.

## 7. Players and skins

Player heads use the configured provider preference:

- Automatic fallback.
- Crafatar.
- MC Heads.
- Minotar.
- Same-origin proxy.
- Disabled.

Automatic mode tries the available configured providers in order. Direct third-party providers receive the viewer's request metadata, so use the same-origin proxy when that privacy boundary is required.

Moderation, operator and permission actions remain capability-checked signed operations. High-risk player actions require typed confirmation. Owner-only actions are not enabled for a Viewer or an unverified/stale grant.

## 8. Backups, schedules and Activity

### Backups

The Backups page requires a current Host response and a successful preflight. Creation is enabled only when the required readiness fields are true, including authenticated Host access, a writable backup root, a configured command channel, no conflicting operation and no unresolved recovery condition.

Backup operations are reviewed before dispatch. The page reports local and offsite state separately and does not treat a degraded remote verification as a successful complete backup.

### Schedules

Schedules edits the existing maintenance settings returned by Host. It validates required exclusions, time zone, limits and schedule shape before allowing review and dispatch. It does not invent arbitrary task scheduling unsupported by the current contract.

### Activity

Activity is intentionally not a second full console. It concentrates on:

- Player joins and leaves.
- World-generation warnings and errors.
- Backup-critical events.

The initial list is compact, with filters and explicit expansion for older relevant events.

## 9. Permissions and safety model

Client authorization is resolved in one place.

- A verified Owner receives all 54 known dashboard scopes client-side.
- A non-Owner receives only the valid intersection of the signed and reported grants.
- Agent presence, capability support, selected-server identity, generation binding, data freshness and review requirements remain separate gates.
- The server's final result is authoritative.
- Prepared actions are invalidated if the selected server, connection generation or authority changes.
- Mutations are not automatically retried after an unknown outcome.

An Owner credential issued before a server-side grant migration may still receive `SCOPE_DENIED`. Re-pair the Owner after the Core migration rather than weakening client checks.

**Access & audit** displays the current effective grant, all visible permissions, paired devices and the recent audit trail. The current device cannot revoke itself through the device list.

## 10. Settings available now

### Interface

- Theme: Light, Dark or System.
- Density: Comfortable or Compact.
- Reduced motion.
- Time display: Browser time zone or UTC.
- Accent: Indigo, Teal, Sky or Rose.

Accent changes do not recolor semantic chart series.

### Graphs

- Display update rate: 50–1000 ms.
- Format: Area or Line.
- Curve: Smooth, Straight or Step.
- Detail: Rich or Compact.

### Server icon

The panel logo can use the selected server's icon.

- **Load server-icon.png** requests the file through the existing signed download flow when available.
- A local 64×64 PNG can be selected manually.
- **Reset** removes the locally stored icon for that server.
- Icons are verified, decoded and stored per server in this browser.

### Diagnostics

Settings displays dashboard/build identity, protocol version, Paper capture time and grant role. **Copy redacted diagnostics** is the safe support path; do not send pairing credentials or private environment values.

## 11. Responsive behavior

The shell and all eleven routes were checked from 320×568 through 1920×1080, including the supplied 1577×929 Console viewport.

- Desktop uses the sidebar and full workspace layout.
- Compact widths use adaptive navigation and wrapped controls.
- Console input, History, macros and fixed navigation remain reachable on mobile.
- Charts reduce tick density and contain hover overlays inside the plot.
- Tables that cannot sensibly stack remain in labelled horizontal-scroll regions.
- Long console rows may be visually truncated on mobile to protect page geometry.

## 12. Local development and review

Requires Node 24.x.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set only the public relay origin:

```dotenv
VITE_PLEXON_RELAY_URL=https://relay.example.com
```

Design-review mode:

```text
http://127.0.0.1:4173/?demo=1#Overview
http://127.0.0.1:4173/?demo=1&idle=1#Overview
http://127.0.0.1:4173/?demo=1&offline=1#Overview
```

Demo and Styleguide modules are compile-time excluded from production.

Run the release checks:

```sh
npm run check
npm run build
npm run test:perf
npm run test:visual
npm run test:revamp
npm run test:refinement
npm run test:release65
```

Browser suites require Playwright Chromium or `PLEXON_CHROMIUM` pointing to a compatible executable.

## 13. Current verification status

- 56 unit and contract tests passed.
- 43 retained/refinement browser interactions passed.
- 132 final light/dark desktop/mobile state screenshots passed overflow, runtime and axe checks.
- 88 additional route/viewport cases passed.
- Every page scored 45–49/50 with no rubric category below 4.
- Console scored 47/50 after the command, history and lifecycle correction.
- Production build passed.
- Initial-route JavaScript: 99,871 bytes gzip against a 180 KiB budget.
- Lighthouse: 99/100/100 mobile and 100/100/100 desktop for Performance/Accessibility/Best Practices.

## 14. Known boundaries

- Live paired VPS acceptance is still required for real Host telemetry, server-side Owner migration, live skin resolution and signed server-icon transfer.
- The current Host schema does not provide per-core CPU, network throughput or disk I/O rates. Do not infer them in the dashboard.
- Full backup restore/download/recovery UI remains deferred even though relevant signed protocol actions may exist.
- Arbitrary schedules, world editing and standalone plugin management are not supported by the current UI contract.
- Physical Safari, Firefox, screen-reader, soft-keyboard and device frame-pacing certification remains outstanding.

## 15. Rules for future dashboard changes

1. Preserve every endpoint, pairing flow, server binding and signed action boundary.
2. Do not reintroduce Files or standalone Plugins pages unless the owner explicitly reverses that decision.
3. Do not add a second permission system. Extend the single authority resolver when the protocol gains scopes.
4. Do not add another chart state layer over the current fixed-window pipeline.
5. Never synthesize production telemetry or turn stale/missing data into zero.
6. Keep Console history server-scoped, bounded and browser-local.
7. Preserve the single lifecycle review and required agent confirmation flag.
8. Keep demo/styleguide code excluded from production.
9. Run the full light/dark, desktop/mobile, healthy/idle/offline review loop after UI changes.
10. Do not call a change complete until tests, build, responsive checks and the visual threshold pass.

## 16. Related release documents

- [6.5.0 final report](REVAMP_REPORT.md)
- [Audit and architectural findings](REVAMP_AUDIT.md)
- [Visual review and scores](REVAMP_REVIEW.md)
- [Design system](DESIGN_SYSTEM.md)
- [Migration and rollback](MIGRATION_ROLLBACK.md)
- [Release changelog](../CHANGELOG.md)
