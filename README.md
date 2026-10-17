# PlexonPanel 5.0 · Obsidian Telemetry Workbench

Next.js App Router, React 19, Tailwind CSS, shadcn-style Radix primitives, Lucide, cmdk/Sonner, TanStack Virtual and synchronized uPlot graphs across eight operational workspaces. Protocol 3 pairing, signed agent identities, scoped capabilities, authority generations and reviewed exact targets remain authoritative.

The owner directive in [docs/v5/MASTER_DIRECTIVE.md](docs/v5/MASTER_DIRECTIVE.md) supersedes historical framework, operational browser-cache and manual-only backup restrictions. Older planning documents remain historical evidence.

## Run

Node 24.x:

```bash
npm ci
NEXT_PUBLIC_PLEXON_RELAY_URL=https://your-relay.example npm run build
npm start
```

Set the public relay origin consistently at build and runtime, matching the existing paired relay. A per-request CSP nonce allows only that configured HTTPS/WSS origin. No credentials belong in public environment variables. The Vercel framework is nextjs; main Git deployment is enabled by the owner’s 2026-10-17 release authorization; staging branches remain disabled. The installed public VITE_PLEXON_RELAY_URL is accepted at build time when NEXT_PUBLIC_PLEXON_RELAY_URL is absent.

Origin-bound credentials, selected server and directory/relay metadata remain in IndexedDB. Its version-2 migration purges operational caches. Only the eight appearance/privacy preferences use localStorage. Console, chat, presence, telemetry and audit stay in bounded volatile memory and are queried again after reload. No service worker or browser log database is introduced.

## Workspaces

| View | Operational behavior |
| --- | --- |
| Fleet | Passive bounded connections, exact selection and authenticated node attribution |
| Overview | Source evidence, tick percentiles, boot metadata, world footprint and reviewed lifecycle actions |
| Performance | Eight synchronized signals plus separate JVM, cgroup and node memory; raw evidence, real gaps and GC/presence markers |
| Players | Virtual roster, exact UUID inspector, existing gameplay/moderation builders and Host boot-session timeline |
| Console & Chat | Measured virtual rows, Host SQLite search/severity/cursors, volatile chat hydration, reviewed commands and existing inventory |
| Backups | Durable Host job and recovery evidence, manual cold backup, periodic schedule/retention editor and exact archive actions |
| Access & Audit | Signed scope/capability intersection, protected device revocation and virtual audit records |
| Settings | All eight preferences, relay/pairing recovery and redacted JSON diagnostics |

Paper owns gameplay and pairing. Host owns the fixed systemd unit, private session storage and cold backups. A queued acknowledgement is not completion. Mutations are never automatically retried, and no browser input chooses shell commands, rclone flags, credentials or systemd units.

## Verification

```bash
npm run check
npm run build
npx playwright install --with-deps chromium
npm run test:browser
npm run test:interactions
npm run test:perf
```

Browser fixtures are development-only and prominently labeled. The production benchmark must be built with `NEXT_PUBLIC_PLEXON_RELAY_URL=https://tonimserver.ddns.net`; all relay traffic is intercepted and no operational relay is contacted. It loads 8192 raw captures, 2500 console rows and 11 canvases with viewport-aware redraw. PLEXON_CHROME_PATH can select an installed browser.

`npm run test:flow` additionally uses the adjacent Java25 Host build and actual SQLite store through a synthetic loopback relay. Set PLEXON_HOST_JAR and PLEXON_JAVA if defaults differ. It never launches HostMain, systemd, RCON or Google Drive.

## Release boundary

The supplied archives omit the relay implementation. Its additive events.session.list, chat.history and session.epoch_reset routing must be certified against the deployed relay; scope-checked server.status fallbacks support the two reads. Actual journald/RCON/Drive/provider isolation and Vercel origin authorization remain installation checks. No live deployment, branch push, credential or VPS change is implied. See [docs/v5/RELEASE_VERIFICATION.md](docs/v5/RELEASE_VERIFICATION.md).
