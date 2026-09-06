# Vercel deployment

## Dashboard

Use repository root, Next.js, Node 24, `npm ci`, `npm run build`. The only required Vercel variable is:

```dotenv
NEXT_PUBLIC_PLEXON_RELAY_URL=https://YOUR-RELAY.workers.dev
```

`npm run env:vercel -- --relay-url https://YOUR-RELAY.workers.dev` creates an ignored import file. Rebuild after URL changes because the client/CSP includes it. No Firebase or server-side Vercel credential is needed. Preview origins require explicit relay allowlisting; do not promote a preview before acceptance.

During a maintenance window upgrade relay with preserved keys first, matching dashboard next, then stopped-server Paper JAR and optional host. Verify the Paper UUID/fingerprint, re-pair an Observer, test denials/revocation, then grant only needed roles. Rollback is coordinated with saved configurations/baselines; never delete identities/namespaces to make old tokens work.
