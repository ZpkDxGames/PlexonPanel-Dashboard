# PlexonPanel Dashboard 2.1.0

## Control room redesign

Dashboard 2.1 introduces a compact Plexon control-room shell built around graphite/navy surfaces, restrained cyan and violet accents, grouped navigation, clearer server identity, and a responsive mobile navigation drawer. The shell adds Paper/Host connection indicators, explicit data freshness, quick actions, and a lightweight `Ctrl/Cmd + K` command palette.

## Telemetry & graph improvements

The Overview now exposes primary Paper health metrics alongside host CPU, memory, disk, and JVM heap values without inventing missing telemetry. A browser-derived health summary explains the available signals and reports an unavailable state when there is not enough live data.

The Performance workspace now supports 1, 5, 15, and 30 minute browser-local windows; pause/resume without disconnecting the WebSocket; hover crosshairs and nearest-sample values; readable axes and reference lines; current/minimum/average/maximum/P95 summaries; CSV and JSON export; and confirmed browser-local history reset.

Browser telemetry remains bounded local history. Closing the browser does not imply historical server storage exists.

## Management workflow improvements

The existing Players, Console, Chat, Plugins, Files, Backups, Audit, Access, and Settings implementations remain available and inherit the updated 2.1 control/surface styling. Existing scope/capability checks continue to be authoritative.

## Server lifecycle UX

Server lifecycle controls now interpret the available systemd-style service state and prevent impossible operations. In particular, Start is disabled while the service is active, while graceful stop and restart are enabled only when allowed by the active state and host policy. Activating/deactivating states disable conflicting controls, and failed state is presented with recovery guidance.

Long lifecycle actions expose a client-observed operation timeline and only include stages that can be inferred from the request/result and authenticated Paper connection state.

## File manager improvements

The existing protocol-3 file manager remains constrained to configured roots, capability checks, path validation, size limits, and hash-based conflict handling. Dashboard 2.1 does not expand host filesystem authority.

## Backup experience

Existing create/list/download/delete/restore workflows and restore confirmation safeguards remain in place. Backup state stays authoritative on the host or configured off-site provider rather than being moved into Vercel or a new database.

## Access & audit improvements

Known operation failure codes now map to clearer operator guidance, including capability-disabled, scope-denied, Owner-required, busy, server-must-be-stopped, and restore-recovery states. Raw exception internals and secrets are not exposed through these messages.

## Responsive/mobile improvements

The new shell is designed for desktop, tablet, and narrow mobile widths with compact controls, a mobile navigation drawer, responsive telemetry grids, scroll-safe charts, and viewport-contained action menus.

## Accessibility

Dashboard 2.1 adds consistent focus-visible states, semantic button controls, readable textual chart summaries, an ARIA-live notification surface, keyboard-accessible command palette invocation, and reduced-motion handling.

## Security/compatibility

- Protocol remains **v3**.
- No relay identity or signing-key rotation is required.
- No Durable Object reset or namespace replacement is required.
- Existing paired protocol-3 device credentials remain compatible unless a separate security migration explicitly requires otherwise.
- No telemetry database, Firebase dependency, inbound administration port, or RCON requirement was introduced.
- Existing role scopes, local agent capabilities, Owner restrictions, confirmation requirements, and signed agent communication remain authoritative.
