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
