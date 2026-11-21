# Standalone Protocol 3 relay

The Node 24 standalone relay was recovered from the 5.0.0 source revision pinned by the backend release manifest. The earlier dashboard tree removed the relay during the Command Center rebuild. The recovered source keeps the legacy Paper and Linux Host room and SQLite coordination contracts. The standalone runtime is built and started independently of Next.js. [Pinned 5.0.0 source](https://github.com/ZpkDxGames/PlexonPanel-Dashboard/tree/da691360b39435d02a8671f45f2a2c4c49e3adbe/relay) · [5.0.0 manifest](https://github.com/ZpkDxGames/PlexonPanel/blob/main/docs/release-gates-5.0.0.json)

```bash
npm ci
npm run relay:test
npm run relay:standalone:smoke
npm run relay:standalone:package
node --env-file=/path/to/private/relay.env relay/dist/standalone/server.js
```

The package is emitted under `artifacts/plexonpanel-relay` with the standalone server, an environment example and the existing systemd unit template. Use a new loopback port, database and private keys on staging. The existing exact browser-origin checks and Protocol 3 agent handshake apply to both editions. Supply an optional Bedrock enrollment file with `PLEXON_RELAY_BEDROCK_CONFIG`. See the backend Bedrock ARM64 runbook for initialization, separate read-only authorization and rollback.
