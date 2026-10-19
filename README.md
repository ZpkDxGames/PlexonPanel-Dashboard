# PlexonPanel — Obsidian Mission Deck

A completely rebuilt presentation layer over the unchanged Protocol 3 core: 64px navigation rail, a 56px mission header, four 148px instruments, a flush telemetry studio and eight operational workspaces.

Read `AGENTS.md`, `SKILL.md`, the [v5.3 telemetry/event notes](docs/V53_TELEMETRY_EVENTS.md) and [architecture decisions](docs/MISSION_DECK_ARCHITECTURE.md) before editing. The root contract supersedes the older visual specifications.

Use Node 24:

```sh
npm ci
npm run dev
```

Set the relay origin with `NEXT_PUBLIC_PLEXON_RELAY_URL` (legacy `VITE_PLEXON_RELAY_URL` is supported). The existing CSP allows `tonimserver.ddns.net` HTTPS/WSS; coordinate origin changes with that allowlist. Existing browser pairing and signed target/scoping semantics remain in the adapter.

```sh
npm run verify:purge
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run verify:production
npm run verify:structure
node scripts/polish-checks.mjs
```

`CHROME_PATH` can select a locally installed Chromium executable. `EVIDENCE_DIR` sets the screenshot and receipt destination. CI runs the production smoke test and the full structural browser suite.

The structural suite covers all eight routes at 1545×911, 1280×800, 1920×1080 and 390×844 in both themes. Development fixtures include `?fixture=structural`, `normal-load`, `roster-events`, `host-stale`, `volume`, `healthy`, `stale`, `partial`, `stopped`, `offline`, `denied`, `starting`, `stopping` and `unknown`. Production ignores fixture parameters.

The scope matrix is inspect-only because the current action contract provides no scope-editing action. Preferences retain the store's exact eight keys and valid values. The analyzer's 2h selector cannot exceed the headless core's 35-minute retention window. Console/chat and command history remain memory-only. Restore obtains the Host confirmation token before the full typed review.

The delivered package includes an offline visual comparison viewer and exact verification receipts. The backend source is unchanged. Its Gradle/Java 25 checks and real VPS/relay/server operational validation remain subject to the limits recorded in the verification report. This source package does not deploy or alter running services.
