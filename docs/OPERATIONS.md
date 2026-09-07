# Dashboard operations and privacy

Settings/Access show current scopes and locally advertised capabilities. Disabled actions may require a scope, enabled local capability, connected source agent or literal Owner. Security policy changes only locally.

Connectivity distinguishes unpaired, expiry/revocation, protocol mismatch, relay unavailable/reconnecting and Paper/host offline. Cached charts are stale, but cached players are never displayed as online. Host presence does not imply Minecraft runs; restart success waits for authenticated Paper reconnection.

## Appearance and behavior

Dashboard 2.3.0 presentation preferences are browser-local and strictly allowlisted. Theme, accent, contrast, density, text scale, player display, graph display, timestamp display, and motion do not travel over protocol 3 and cannot modify grants, Paper retention, server capabilities, telemetry cadence, or host policy.

System theme/contrast/motion follow supported browser/OS media queries. Reduced motion is treated as a safety floor; Reduced removes travel/scaling/drawing-style motion and Off disables nonessential animation and smooth scrolling. Reset appearance changes presentation only and does not delete credentials or forget the server. Preference changes may synchronize across tabs through browser storage events; actions and credentials do not.

The optional player-head provider is configured at dashboard build/deployment time. With no valid template, no remote avatar request occurs and deterministic local fallbacks remain fully functional. When configured, current online rows and the current-player drawer may lazy-load heads after the roster renders. Disable **Show skin heads** to stop new remote head requests in that page. Player-history rows never request remote avatars.

A third-party avatar provider can observe the viewer's network address and requested current-player UUIDs. Image failures are quiet and fall back locally. The dashboard does not store image bytes in its persistent browser stores or relay storage.

## Players

The Players workspace has an Online view and, only with a qualifying immutable grant plus enabled Paper capability, a History view. Immediate `players.presence` deltas update the current signed Paper session. A complete player snapshot reconciles missed/out-of-order deltas atomically. Refresh requests a real Paper snapshot and is limited once per device per five seconds; repeated requests can coalesce.

On mobile, Online defaults to cards containing head/fallback, name, online state, world, ping, session duration, and a single Manage control. Desktop retains the table. UUID visibility and current-roster head size are browser presentation preferences; authoritative data and permissions are unchanged.

History search accepts a bounded name/UUID fragment, status and local date range. Paper returns newest-first cursor pages with an explicit bounded indicator. Times can be shown in browser local time or UTC while preserving the source instant. Unknown logout and duration remain unknown. Offline history drawers are read-only; queried entries remain only in current memory and are never inferred from browser disappearances.

## Telemetry

Performance history remains capped at 361 samples/30 minutes. The 1/5/15/30-minute controls change the presented bounded window only. Line versus area, grid, column layout, timestamp display and Pause/Resume are browser presentation choices; statistics and CSV/JSON exports continue to use the raw received samples.

Missing samples remain visible gaps. TPS retains the degraded reference and MSPT retains the tick-budget reference; CPU/memory do not invent universal warning thresholds. Pause freezes the chart presentation only and does not stop WebSocket reception. Decorative live-tail motion stops when paused, disconnected, offscreen, in a hidden tab, or disabled by the resolved motion profile.

## Storage, files and audit

Server workspaces isolate credentials/cache by UUID. Received logs/chat/plugin names/files are text, never executable HTML. The file editor supports allowed UTF-8 up to 24 KiB, JSON validation, hash conflicts with retained drafts, original/edited review, Ctrl/Cmd+S and unsaved-navigation warnings. SQL is read-only, binary writes forbidden; other text-format syntax is the operator's responsibility.

General downloads max 8 MiB, backup downloads max 64 MiB, with ordered 16 KiB chunks, cancellation/expiry and final SHA-256 before download. Larger archives use local administration/configured rclone. File bodies/action outputs never enter persistent cache or relay storage.

Restore requires Owner, local enablement, stopped Paper, a short-lived device/archive-bound nonce, typed server name and final confirmation. Success leaves Paper stopped. Recovery-required is handled locally; dashboard cannot bypass the journal.

The sanitized telemetry cache expires in one hour. Online players, detailed presence history and sensitive player address/location remain excluded. Bearer credentials persist until expiry/forget, subject to immediate revocation. Use a trusted private browser profile.

Audit reads bounded local JSONL with filters/50-entry pages, excluding command/message/file bodies and secrets. Last-seen means last successful authorized activity, throttled to one minute. A lost browser should be revoked locally.

The relay sees transient routed data; TLS is not end-to-end encryption against it. Restrict full console/chat and use sanitized diagnostics. A disconnected/timed-out request has an unknown outcome and is never resent automatically; inspect audit/server state before retrying.
