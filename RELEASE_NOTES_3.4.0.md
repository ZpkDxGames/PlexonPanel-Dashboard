# PlexonPanel Dashboard 3.4.0 — Host-authoritative console and relay consolidation

Dashboard 3.4.0 is the matched browser/relay release for PlexonPanel 3.4.0. It keeps signed Protocol 3 and the existing device/access model while adding a Host-authoritative Linux console path, preserving Paper command authority, and consolidating the standalone Node relay into the canonical Dashboard repository.

## Host console authority

- The relay accepts Host `console.source` health state and bounded Host `console.lines` batches only from an authenticated, locally pinned Host agent.
- Host console authority is active only when the Host source is healthy and Host local capability permits full console viewing.
- Paper remains the fallback console producer whenever Host authority is unavailable.
- `console.execute` remains Paper-only. Worker and standalone relay paths explicitly reject a Dashboard attempt to route console execution to Host.
- Dashboard ready state exposes the effective console authority and Host source state instead of inferring authority from socket connectivity alone.

## Console workspace

- Browser console history is bounded to 2,500 live lines and a smaller bounded safe-cache subset.
- Journal cursor/invocation/session metadata is used for strong duplicate suppression where available, with a short bounded cross-source transition check for equivalent Paper/Host lines.
- The console shows source/authority state and invocation-based startup separators.
- Host output remains visible when Paper is offline. Command entry is unavailable until Paper is connected and authorized.
- Pause, copy, export and clear remain browser-local presentation behavior; they do not stop the WebSocket or mutate server logs.

## Standalone relay consolidation

- The previously separate standalone relay implementation is now present in the canonical Dashboard release line together with its configuration, persistence, WebSocket transport, service/env examples, packaging script, smoke test and migration documentation.
- The certified pre-3.4 Worker and standalone relay cores are retained as explicit core source units, with small 3.4 authority adapters around them.
- Shared scope filtering, Protocol 3 signing/replay protections, access sync, pairing, backup coordination, bounded request handling and action routing remain intact.
- CI builds and tests both relay runtimes and additionally runs standalone smoke and packaging validation.

## Version and compatibility

- Dashboard package, visible version metadata, Worker health identity and standalone ready state are 3.4.0.
- Protocol remains 3. There is no Protocol 4 migration, server identity reset, automatic grant expansion, or re-pair requirement introduced by this release.
- Existing console scopes remain `console.view.errors`, `console.view.full`, and `console.execute.allowed`; visibility still requires the device scope and the selected agent's local capability.

## Validation

The release workflow runs linting, application and relay TypeScript validation, Worker/standalone relay tests, browser/state/UI tests, relay smoke checks, standalone smoke/package checks, and a production Next.js build. Vercel preview deployment is additional presentation evidence but does not replace repository CI.

Live PlexonCraft deployment remains a separate operational gate. Runtime restart/failure/cursor-recovery acceptance must not be inferred from CI or the Vercel preview.
