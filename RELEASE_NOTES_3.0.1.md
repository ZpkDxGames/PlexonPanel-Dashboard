# PlexonPanel Dashboard 3.0.1 — Release Notes

Dashboard 3.0.1 integrates the faster PlexonPanel 3.0.1 Paper/Host telemetry pipeline into the existing protocol-3 control room without changing the wire protocol or weakening the local authorization model.

## Highlights

### Source-aware fast telemetry

- Removed the legacy five-second chart-history bucket that hid sub-second agent telemetry.
- Performance history now uses trusted source `capturedAt` timestamps when available.
- History is bounded by both a rolling retention window and a hard point cap.
- Duplicate source timestamps replace the existing sample instead of creating duplicate chart points.
- Raw history remains available for statistics/export while SVG rendering uses bounded extrema-preserving thinning.
- TPS/MSPT, Host CPU, Paper process CPU, Host memory and JVM heap remain separate metrics with explicit authority/source labels.

### Display update rate now governs visible telemetry

The browser-local Display update rate continues to support:

- Realtime — every accepted presentation update
- Fast — 250 ms maximum commit rate
- Balanced — 500 ms maximum commit rate
- Relaxed — 1 second maximum commit rate
- Low activity — 2 second maximum commit rate

Authoritative state still consumes accepted messages immediately. Operational events including player presence, console/chat stream batches, lifecycle/service state, backup progress and action results bypass the presentation throttle so slower chart preferences do not make the control room operationally stale.

### Paper and Host authority correctness

- Host CPU is machine-wide Host CPU only.
- Paper process CPU is Paper process CPU only.
- Host memory and JVM heap are no longer interchangeable fallback metrics.
- Overview reports Paper and Host connection/health independently.
- Performance charts become disconnected only when their owning authority is unavailable.
- Server systemd status and start/stop/restart are strictly Host-authoritative; Paper connectivity is no longer used to fabricate a service state.

### Player integration

- Current player search includes both canonical name and display name.
- Current roster/detail UI supports display name, operator state and whitelist state in addition to the existing Paper 3.0 player fields.
- Optional location/address details are omitted when not supplied rather than rendered as synthetic unknown values.
- Live row highlight applies only to recently changed current-player rows.
- Player join/quit presence bypasses telemetry display throttling and still reconciles against authoritative snapshots.
- Historical/offline UI remains avatar-free and read-only.

### Player heads

- The built-in provider is `https://mc-heads.net/avatar/{uuid}/{size}` when no override is supplied.
- `NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE` can override the provider.
- The exact `disabled` sentinel disables remote player heads deployment-wide.
- Provider state is shown in Settings as built-in, custom, disabled or invalid.
- Invalid/malformed providers fail closed and keep the deterministic local fallback.

### Settings and operator clarity

- Display update rate copy now clearly states that it controls accepted telemetry painting in this browser rather than server-side collection.
- Host source cadence is shown when explicitly advertised by the Host payload.
- Browser display cadence is shown directly.
- Critical connection, authorization, lifecycle and action state is documented as immediate.

## Compatibility

- Wire protocol remains **3**.
- Existing device grants remain immutable.
- No new UI-only scope aliases were introduced.
- Older 3.0 agents may emit slower telemetry or omit newer metadata and player fields; optional parsing and safe fallbacks remain supported.
- Files and Backups remain outside the primary navigation for this release.

## Security invariants

Dashboard actions remain the intersection of:

1. device grant/scopes;
2. connected agent kind;
3. agent-advertised capability;
4. local Paper/Host policy;
5. action-specific requirements such as Owner-only operations;
6. confirmation requirements for high-risk actions.

The release does not make disabled UI controls a security boundary, does not proxy avatars through the relay, does not make browser preferences mutate server policy, and does not add telemetry/history/player data persistence to the relay.

## Validation

Required automated gates:

```sh
npm ci
npm run check
npm run relay:smoke
npm run build
```

Required live PlexonCraft checks remain:

- Paper and Host independently connected/disconnected states;
- Realtime, 250 ms, 500 ms, 1 second and 2 second browser display cadence;
- immediate lifecycle/action/presence feedback while slower display cadence is selected;
- real online-player head rendering plus fallback/disabled behavior;
- no historical-avatar requests;
- Host/Paper metric source correctness;
- responsive desktop, split-screen, tablet and mobile layouts;
- 80%, 100%, 125% and 150% browser zoom;
- reasonable browser CPU and no unbounded chart-history growth.

Live checks are deployment acceptance and are intentionally not simulated as passing by repository CI.
