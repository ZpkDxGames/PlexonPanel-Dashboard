# Dashboard UI revamp rollout and rollback

## Compatibility

| Component | Required action |
|---|---|
| Dashboard | Review this source, exact-source CI and browser evidence; deploy via gated existing Vercel project |
| Paper and Host 5.0 / schema 5 | Keep current JARs and instance configurations; no replacement or restart needed |
| Standalone VPS relay | Keep current signed Protocol 3 `/v1` deployment, coordination state and origins |
| Cloudflare Worker | Compatibility tests only. Its production publication remains held |
| Credentials and preferences | Same IndexedDB v3 per-server grant keys and one allowlisted preferences v1 schema |
| Cached chart records | Old records read as explicitly labeled legacy packet-time history; new source provenance is additive |
| Long-horizon reports | Unavailable by design. Reports cover observed browser history, 1–30 minutes |

## Safe sequence

1. Resolve the existing Core x64 CI failure recorded in `UI_REVAMP_BASELINE.md` through its own review and exact-source verification before coordinated production acceptance. Review/merge the Dashboard source PR only after exact-source CI and visual artifacts pass. The Core has no companion runtime diff. Do not merge unrelated Core #95–97 as part of this review.
2. Run the new exact-main CI. Accept its Dashboard SHA/run ID in a **separate receipt-only activation commit**, with that accepted source as immediate parent, exactly as `COORDINATED_DEPLOYMENT_GATE.md` specifies. Keep actual operator backup/rollback evidence accurate and deployed runtime certification NOT_EXECUTED. An earlier receipt cannot authorize this changed source.
3. Use the existing intended Vercel production project, main branch, original HTTPS/WSS origin and production settings. Retain the previous successful deployment. This source PR neither updates the receipt nor bypasses ignore/build guards. Worker previews/publication remain held.
4. Verify `/api/build` against the accepted source and expected protocol/action/fleet contract. In the existing paired browser, open PlexonCraft and TonimSMP, verify UUID/instance identity, independent players, console, backups and charts, switch/reload/background/foreground, and confirm stored preferences survive.
5. Perform read-only production checks first. Record actual deployed TLS/WSS, CORS/CSP, grants and agent freshness. Lifecycle/backup/restore and filesystem/journal permissions remain separately gated runtime tests in isolated staging or an authorized maintenance window.

No VPS services, polkit rules, Caddy routes, identity keys, RCON/Drive credentials, world data, ACLs, voice chat UDP 24455, or Minecraft/Host ports need changes.

Rollback: restore the previous Vercel Dashboard deployment and confirm its build identity. No credential migration, world rollback, schema downgrade or relay rollback is introduced. Previous clients ignore optional new browser history numeric/provenance fields. If a previous implementation renders older cached points using packet time, those points retain its preexisting reporting limitations; current operational freshness still comes from source snapshots.

## Reproduce source verification

`npm ci && npm run check`, both relay smokes, standalone packaging, production dependency audit and `npm run build` are required. Native checks: `npx playwright install --with-deps chromium` then `npm run test:browser`. The browser script launches only loopback fixtures and captures all pages at six widths, dark/high contrast/125% text, keyboard/modal/server-switch and connection states. It never reads deployed credentials.

For a 15-minute native stress profile: `PLEXON_UI_SOAK_MS=900000 node scripts/benchmark-ui.mjs`. An existing local Chromium executable can be selected with `PLEXON_CHROMIUM_EXECUTABLE`. No browser executable or test credential is committed. The benchmark explicitly labels development-mode software-rendered local measurements; it is not a production Lighthouse or VPS certification.

The standalone Fleet stress variant uses `PLEXON_UI_BENCHMARK_VIEW=fleet PLEXON_UI_SOAK_MS=60000 node scripts/benchmark-ui.mjs`. Compare with the same script and fixtures against the recorded baseline checkout using `PLEXON_UI_PROJECT_ROOT`; use distinct labels and caches. After a clean production build, `node scripts/measure-ui-build.mjs` records emitted JS/CSS and initial HTML references with chunk hashes. These figures do not claim actual network transfer.
