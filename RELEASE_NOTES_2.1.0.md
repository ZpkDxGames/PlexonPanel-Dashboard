# PlexonPanel Dashboard 2.1.0

## Control room redesign

Dashboard 2.1 introduces a compact Plexon control-room shell built around graphite/navy surfaces, restrained cyan and violet accents, grouped navigation, clearer server identity, and a responsive mobile navigation drawer. The shell adds Paper/Host connection indicators, explicit data freshness, quick actions, and a lightweight `Ctrl/Cmd + K` command palette.

## Telemetry & graph improvements

The Overview now exposes primary Paper health metrics alongside host CPU, memory, disk, and JVM heap values without inventing missing telemetry. A browser-derived health summary explains the available signals and reports an unavailable state when there is not enough live data.

The Performance workspace now supports 1, 5, 15, and 30 minute browser-local windows; pause/resume without disconnecting the WebSocket; hover crosshairs and nearest-sample values; readable axes and reference lines; current/minimum/average/maximum/P95 summaries; CSV and JSON export; and confirmed browser-local history reset.

Browser telemetry remains bounded local history. Closing the browser does not imply historical server storage exists.

## Management workflow improvements

Players now provides search, world filtering, sorting by name/ping/session/world, online counts, and a structured management drawer for overview, permitted actions, and moderation. Player controls continue to be hidden or disabled by the intersection of device scope and local Paper capability policy.

Console now includes severity segments, search, pause/resume, follow-tail, timestamp and wrap controls, local display clearing, line copy, visible-output copy, browser-session log export, and bounded command history. Pausing or clearing the browser view does not stop the authorized WebSocket stream or delete server logs.

Chat now includes search, pause/resume, follow-tail, local clear, message copy, scoped sending, and an optional MiniMessage control only when the corresponding scope and capability are present. PlexonChats is identified only when explicit integration data indicates it is active.

Plugins now provides search, enabled/disabled filtering, name/version sorting, inventory counts, and a details drawer for available metadata. Dedicated reload remains controlled by local plugin policy; no generic Bukkit/Paper reload was added.

## Server lifecycle UX

Server lifecycle controls now interpret the available systemd-style service state and prevent impossible operations. In particular, Start is disabled while the service is active, while graceful stop and restart are enabled only when allowed by the active state and host policy. Activating/deactivating states disable conflicting controls, and failed state is presented with recovery guidance.

Long lifecycle actions expose a client-observed operation timeline and only include stages that can be inferred from the request/result and authenticated Paper connection state.

## File manager improvements

The protocol-3 file manager retains its configured-root boundaries, capability checks, path validation, size limits, chunk verification, hash-based conflict handling, diff review, and explicit write/delete safeguards. Dashboard 2.1 restyles the workspace without expanding host filesystem authority.

## Backup experience

The existing create/list/download/delete/restore workflows retain host-authoritative progress and restore safeguards, including preparation and server-identity confirmation where required. Backup state stays authoritative on the host or configured off-site provider rather than being moved into Vercel or a new database.

## Access & audit improvements

Audit now provides Paper/Host source selection, server-side filters, search over loaded records, pagination, result badges, entry inspection, request-ID copy, and JSON copy while retaining the local agent as the authoritative source.

Access now provides device search, role filtering, current-device and expired-state indicators, scope inspection, and guarded revocation. Connected/disconnected status is not inferred from last-seen timestamps.

Known operation failure codes map to clearer operator guidance, including capability-disabled, scope-denied, Owner-required, busy, server-must-be-stopped, and restore-recovery states. Raw exception internals and secrets are not exposed through these messages.

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
