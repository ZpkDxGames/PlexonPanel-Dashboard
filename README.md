# PlexonPanel Command Center

A fresh operations dashboard for PlexonPanel protocol 3. The project has independent Git history and a new React/Vite/TypeScript interface; the existing Dashboard and Core repositories are integration references only.

## Local setup

Requires Node 24.x.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set only the public `VITE_PLEXON_RELAY_URL`. Never place Cloudflare credentials, pairing peppers, token secrets or signing keys in frontend variables.

## Checks

```sh
npm run check
npm run build
npm run test:perf
npm run test:browser
```

`test:browser` requires a locally installed Playwright Chromium runtime and a running dev server. Development fixtures are available through `?fixture=healthy|skew|stale|partial|stopped|offline|denied`; production builds exclude the fixture module.

## Deployment

Create a separate Vercel project, set `VITE_PLEXON_RELAY_URL`, and add that exact HTTPS and WSS relay origin to `connect-src` in `vercel.json`. Add the new dashboard HTTPS origin to the relay allowlist. Do not promote over the existing production project until live acceptance is complete.

See `docs/MIGRATION_ROLLBACK.md` for rollout and pairing steps.

## 6.5.0 adaptive telemetry release

Use Node 24: `npm ci`, `npm run dev`, `npm run check`, `npm run build`.
Design review: `http://127.0.0.1:4173/?demo=1` (`&idle=1`, `&offline=1`, `#Console`). The UI theme control persists its choice. Demo and `#Styleguide` run only in development/verification builds; production uses the existing paired relay.

QA: `npm run test:visual`, `npm run test:revamp`, `npm run test:refinement`, `npm run test:release65` (install Chromium using Playwright, or set `PLEXON_CHROMIUM`). Vercel remains a static Vite build from `dist`, with the existing relay configuration and CSP. A preview origin requires relay allowlisting.

6.5.0 adds fixed-window, independently inspected telemetry charts; complete effective Owner scopes; the corrected Console action target; and viewport regression coverage from 320×568 through 1920×1080. The 6.0.0 light-glass/dark design, signed authority, endpoints and pairing flow remain intact.

[Audit](docs/REVAMP_AUDIT.md) · [Design system and page/chart extension](docs/DESIGN_SYSTEM.md) · [Scored review](docs/REVAMP_REVIEW.md) · [Final report](docs/REVAMP_REPORT.md).
