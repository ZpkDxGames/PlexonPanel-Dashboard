# Dashboard 3.0.1 Validation Matrix

This document is the release-specific acceptance matrix for the PlexonPanel 3.0.1 Paper/Host integration. Repository CI validates deterministic code paths; the live PlexonCraft checks below must be executed against real 3.0.1 Paper and Host agents before production promotion.

## Automated gates

Run from a clean checkout with the committed dependency lock:

```sh
npm ci
npm run check
npm run relay:smoke
npm run build
```

Acceptance requires all four commands to pass.

## Telemetry source and display cadence

With authenticated Paper and Host agents connected:

| Browser setting | Expected visible commit cadence | Source ingestion |
|---|---:|---|
| Realtime | each accepted presentation sample | every accepted source message |
| Fast | no faster than 250 ms | every accepted source message |
| Balanced | no faster than 500 ms | every accepted source message |
| Relaxed | no faster than 1 s | every accepted source message |
| Low activity | no faster than 2 s | every accepted source message |

For every setting verify:

- WebSocket stays connected when the setting changes.
- Latest accepted value wins when intermediate display commits are coalesced.
- No backlog avalanche occurs when a throttle window closes.
- TPS/MSPT charts and cards update on the selected displayed-state cadence.
- Host CPU/memory charts and cards update on the selected displayed-state cadence.
- Source timestamps remain ordered and no synthetic interpolation appears.
- 1/5/15/30-minute chart windows remain bounded.
- Browser CPU remains reasonable with Realtime and Fast selected.

## Immediate-state bypass

Select Low activity (2 s) and verify these states still update promptly:

- relay/dashboard ready and disconnect/reconnect;
- Paper/Host connection transitions;
- player join/quit presence;
- console/chat stream batches and command/action feedback;
- Host systemd lifecycle state;
- action success/failure;
- confirmation state;
- authorization/revocation state;
- backup progress if an operation surfaces it.

A disconnected agent must never remain visually connected until the next telemetry display interval.

## Paper vs Host authority

Test these scenarios independently:

### Paper connected, Host connected

- TPS and MSPT are Paper-owned.
- Paper process CPU and JVM heap are Paper-owned.
- Host CPU and Host memory are Host-owned.
- Host CPU is described as machine-wide Linux utilization.
- systemd status/start/stop/restart are Host-owned.

### Paper connected, Host disconnected

- Paper TPS/MSPT/process/JVM information remains available.
- Host CPU/memory become unavailable rather than falling back to Paper metrics.
- Host lifecycle state/actions are unavailable.
- Paper is not used to fabricate an active systemd state.

### Host connected, Paper disconnected

- Host CPU/memory and Host service state remain available.
- Paper TPS/MSPT/process/JVM/player views become unavailable/stale as appropriate.
- Host is not shown offline merely because Paper disconnected.

## Player acceptance

Join with a real player and verify current-player UI can show supplied fields:

- skin head/fallback;
- canonical name and display name;
- UUID according to preference;
- world;
- game mode;
- ping;
- health/max health;
- food;
- level;
- OP state;
- whitelist state;
- online duration;
- session ID/start;
- first seen;
- last login.

Location and address must appear only when the Paper payload actually supplies locally authorized values. When absent, omit them rather than exposing a fake value.

Verify a join highlights only the newly changed row when Live row highlight is enabled, then settles without aggressive flashing. Verify quit removes the player immediately before the next full roster snapshot.

## Player heads and privacy

Test all provider modes:

1. env unset/blank → built-in MCHeads provider;
2. valid custom HTTPS template → custom deployment provider;
3. exact `disabled` sentinel → no new remote avatar requests;
4. malformed template → fail closed;
5. image HTTP failure → deterministic fallback remains stable.

Verify:

- no row layout shift;
- 32px/40px requests track the selected roster head size;
- current-player drawer may use the intended 64px detail head;
- `referrerPolicy="no-referrer"` is present;
- historical/offline rows do not request remote avatars;
- CSP allows only the validated exact provider origin.

## Lifecycle

With Host connected:

- inactive → Start only;
- active → Stop and Restart only;
- activating/deactivating → conflicting actions disabled;
- failed → recovery Start only after operator review;
- unknown → lifecycle actions disabled until Host supplies authoritative state.

Stop and Restart require confirmation. Operation/action feedback must remain immediate even with a 1 s or 2 s browser display cadence. After Start/Restart, authenticated Paper reconnection must be reflected independently; do not treat Paper connectivity as the source of systemd state.

## Responsive matrix

Validate at minimum:

- 1920×1080
- 1600×900
- 1440×900
- 1366×768
- 1280×720
- 1024×768
- narrow split-screen desktop widths
- common tablet portrait/landscape
- common mobile widths

Also validate browser zoom:

- 80%
- 100%
- 125%
- 150%

Pass criteria:

- no overlapping cards;
- no clipped chart labels;
- no text touching container borders;
- dialogs centered in the viewport;
- player heads do not distort rows;
- cards wrap instead of becoming unreadably scaled;
- sidebar remains usable;
- charts retain readable height/aspect ratio;
- action menus/drawers stay inside the viewport;
- keyboard focus and reduced-motion behavior remain usable.

## Compatibility

Use at least one older protocol-3 agent fixture or simulation and confirm missing telemetry metadata, slower samples, absent player-history/session fields, and missing Host source interval do not crash the UI. Protocol remains 3; no protocol bump is expected for this integration release.

## Release record

Record before production promotion:

- commit SHA;
- CI run URL/result;
- relay smoke result;
- production build result;
- Paper agent version;
- Host agent version;
- real-player avatar result;
- display cadence observations;
- responsive/zoom observations;
- browser CPU observation;
- remaining deviations, if any.
