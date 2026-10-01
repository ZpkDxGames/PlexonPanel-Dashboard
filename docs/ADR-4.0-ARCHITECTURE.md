# ADR: Dashboard and relay 4.0 ownership

Status: accepted for the coordinated 4.0.0 source candidate.

PlexonPanel Dashboard and both relay runtimes remain on signed Protocol 3. The release adds fields
and private request/response actions, not a breaking envelope. Existing Paper/Host 3.5.x agents can
therefore roll through the upgrade with explicit unsupported-state fallbacks.

The Dashboard owns presentation, local preferences, signed device credential storage, and the
operator confirmation experience. It does not claim browser-local activity as authoritative and
does not persist console bodies. Paper owns current player state, durable player history and the
optional bounded live-console fallback. Host owns systemd lifecycle, preferred journald console,
retained console history, machine telemetry, backup state and provider verification. The relay owns
only signed routing, explicit source selection, bounded coordination metadata, replay/rate
enforcement, and live session attachment.

Cloudflare continues using the existing `ServerRoomV350` Durable Object class so a product-version
bump cannot discard live room state. The class name is an internal migration identity, not the
reported release version. Worker and standalone builds share Protocol 3 validation, generated
scope contracts, parity tests, request/message limits, and build identity.

The Dashboard must distinguish loading, live, stale, offline, disabled, denied, unsupported,
partial, failed, and completed states. Older Host history falls back to bounded timestamp paging;
Paper fallback never becomes synthetic retained history. Relay health and Dashboard `/api/build` expose
bounded non-secret commit/version/protocol metadata for deployment reconciliation.
