# PlexonPanel Dashboard 2.3.0

Dashboard 2.3.0 is a dashboard-first visual-experience release for the existing PlexonPanel 3.0.0 Paper/Host bundle and signed protocol 3. It does not require a wire-version change, new `/v1` routes, identity rotation, grant migration, or a new relay database.

## Highlights

- A semantic visual layer supports dark, light, system, high-contrast, curated accent, density, and text-scale presentation.
- Appearance & behavior preferences are strictly parsed, versioned, browser-local, and separated from credentials and sanitized telemetry cache.
- Existing density and performance-window settings migrate into the new preference schema.
- Motion resolves through System, Full, Reduced, or Off profiles; reduced-motion remains a safety floor.
- Online-player presentation supports optional Minecraft skin heads, deterministic local fallbacks, responsive mobile cards, current-player drawer identity heads, configurable head size, and UUID visibility.
- Player-history browsing remains avatar-free to avoid exposing historical lookup patterns to an image provider.
- Native SVG telemetry charts retain bounded raw history and add exact keyboard/pointer inspection, gap-aware line/area rendering, reference bands, configurable grids/layout, current/min/max/average/p95 text, local/UTC timestamps, and truthful no-data states.
- Overview adds compact sparklines for TPS/MSPT, CPU, memory/heap, and online-player count.
- Pause freezes chart presentation only; WebSocket reception and authoritative reconciliation continue.

## Avatar-provider privacy and CSP

Player heads remain disabled when `NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE` is blank or invalid. A production template must use HTTPS, contain exactly one `{uuid}`, may contain one `{size}`, contain no credentials/fragments/unknown placeholders, and resolve to one exact image origin. Only that validated origin is appended to CSP `img-src`; broad `https:` and wildcard image origins are not added.

The provider URL is public build configuration and must contain no secret. A third-party provider can observe the viewer's network address and requested current-player UUIDs. Images use native browser HTTP caching only; the dashboard does not copy them into IndexedDB, Cache Storage, Durable Objects, or localStorage.

## Compatibility

- Dashboard: 2.3.0
- PlexonPanel Paper/Host bundle: 3.0.0
- Wire protocol: 3
- Routes: existing `/v1`
- Existing device credentials/grants: compatible and unchanged
- Durable Object storage model: unchanged

## Validation status

The implementation branch has passed the repository's clean GitHub Actions verification path containing `npm ci`, `npm run check`, `npm run relay:smoke`, and `npm run build` with the avatar template unset. Focused automated coverage has been added for preference parsing/migration, avatar-template and UUID safety, and chart geometry/statistics.

Still required before release approval: configured-provider and invalid-provider production-build/CSP evidence, browser and viewport visual acceptance, keyboard/screen-reader checks, network/provider-failure checks, bundle comparison, synthetic screenshots, and disposable-live-server validation where available.

Passing automated checks does not authorize merge, production deployment, tags, a GitHub Release, environment-variable changes, or production CSP changes.
