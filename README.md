# PlexonPanel Dashboard 2.0.0

Responsive Next.js/Vercel control room and outbound Cloudflare relay for protocol 3. **Review candidate: live production acceptance remains pending.** Upgrade together with [Paper/host agents](https://github.com/ZpkDxGames/PlexonPanel).

Twelve sections: Overview, Performance, Players, Console, Chat, Plugins, Files, Backups, Server, Audit, Access and Settings. Features include isolated server workspaces, rolling charts, scoped typed actions with final results, file conflicts/diff, verified downloads and explicit offline/expired/revoked states.

Pair with `/plexonpanel pair <role>` locally. Codes are one-use for five minutes; the operator chooses the role. The browser submits only its label/code. Relay and agent independently check the current grant and local capabilities; Owner cannot override local policy.

```sh
npm ci
npm run check
npm run relay:smoke
```

Use Node 24 and the lockfile. `check` runs lint, types, relay security tests, a production build and client/state/SSR/tool tests. Smoke bundles without deploying and runs actual local workerd using ephemeral keys, with no account credentials.

For development set `.env.local` with `NEXT_PUBLIC_PLEXON_RELAY_URL` and run `npm run dev`. This public HTTPS relay origin is the only required Vercel variable. Never put signing keys/tokens/server credentials in NEXT_PUBLIC variables. Development eval support is excluded from production CSP. No QA route/dataset is shipped.

Read [deployment](docs/VERCEL_DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), [protocol](docs/PROTOCOL.md), [operations](docs/OPERATIONS.md) and [validation](docs/VALIDATION.md). Preserve Cloudflare namespace/signing identity during migration; protocol 3 invalidates unscoped rc.2 tokens and requires local re-pairing.

No Firebase, telemetry database, Vercel server credential, inbound Minecraft administration port, shell or RCON is required. Cloudflare stores identity/access/pairing coordination only. History is bounded browser state; audit/backups remain on agents, with optional configured rclone copies.
