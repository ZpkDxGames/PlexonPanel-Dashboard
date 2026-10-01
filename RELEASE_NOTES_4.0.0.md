# PlexonPanel Dashboard and Relay 4.0.0

Dashboard/relay 4.0.0 is the coordinated browser and routing side of PlexonPanel 4.0.

- Integrates real Host archive/upload/verification/cleanup progress and rejects stale job events.
- Uses Paper as the durable player-history source and Host journald as the durable console-history
  source, with bounded pagination and explicit offline/disabled/denied/unsupported states.
- Restores signed source transitions and an explicit `PAPER_FALLBACK` live state when the locally
  enabled Paper fallback is available and Host journal authority is unhealthy.
- Keeps Cloudflare Worker and standalone Node relay behavior in parity on Protocol 3 without
  persisting console or player-history bodies.
- Compiles canonical checked-in relay sources instead of mutating them through historical
  preparation scripts.
- Pins Next.js 16.3.8 to remediate the critical advisory detected against 16.3.5 and adds a
  production dependency audit to CI.
- Expands the Settings build panel with exact Dashboard/relay version, commit, build time, runtime,
  action contract, Paper/Host version and protocol identity.
- Packages the standalone relay with a source/CI manifest and SHA-256 inventory.

Protocol remains 3. Existing server identities, pairing state and immutable browser grants remain
valid. Repository tests and previews are source evidence; production Vercel/Worker/runtime gates
must still be executed against the exact release commit.
