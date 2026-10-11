# Migration and rollback

## Preview rollout

1. Create a new Vercel project from this repository. Do not reuse or promote over the existing production project.
2. Set `VITE_PLEXON_RELAY_URL` to the public HTTPS relay origin.
3. Replace the self-only `connect-src` policy in `vercel.json` with exactly: `'self'`, that relay HTTPS origin and its WSS origin. Do not add wildcard network access.
4. Deploy preview and copy its exact HTTPS origin.
5. Add that origin to `DASHBOARD_ORIGINS` for the Worker relay or `PLEXON_RELAY_DASHBOARD_ORIGINS` for standalone relay.
6. On the server, generate a fresh pairing code for the new origin and pair a least-privilege monitoring device in Settings. Add operational scopes only after read-only acceptance.
7. Verify Paper/Host source status, skew, fleet switching, a low-risk reviewed action and audit result. Verify backups separately before granting destructive scopes.

## Promotion

Promotion is a separate explicit decision after live acceptance. Existing production remains available throughout. Keep the previous project alias and pairing until the new origin completes observation and action tests.

## Rollback

Restore traffic to the existing production alias; revoke the new preview device; remove the new preview origin from the relay allowlist. No Core, Host, Paper, relay schema or stored server data migration is introduced by this frontend, so rollback requires no backend data reversal.
