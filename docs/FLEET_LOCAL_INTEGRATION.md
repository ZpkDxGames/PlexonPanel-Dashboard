# Local signed fleet integration

`relay/tests/fleet-tcp.test.mjs` starts the real standalone relay on an ephemeral loopback port and connects two signed simulated Paper/Host pairs. It checks independent telemetry, an action/completion bound to the selected room, and revocation of one browser credential while the other remains valid. Relay HTTP routes, WebSocket transport, signature/challenge authentication, room state and credential validation are real. Minecraft/systemd payloads and completions are simulated; no game process, systemd operation, VPS connection or deployed credential is used.

The fixture generates keys and grants only in memory. Tests never print or persist them. `ws` is an explicit development dependency pinned to the version already used by the lockfile's relay tooling. Run `npm run relay:test` after dependency installation and contract generation/build.

## Browser development fixture

`node scripts/serve-fleet-browser-fixture.mjs` exposes the same simulated fleet at loopback port 8788 for a local Dashboard configured for that relay. It writes ephemeral grants to `.test-dist/fleet-browser-credentials.json` with mode 0600; do not print, commit, upload or include this file in screenshots/reports. On ordinary shutdown the grants are deleted. The fixture never calls Minecraft, systemd, RCON or cloud services.

Browser verification must independently confirm fleet rendering, shared-node totals, server selection without retained data from the previous server, accessible controls, confirmation target labels and mobile layout. A successful Node transport test is not evidence of those browser checks or production runtime certification.

## Current execution evidence

The two-room TCP test executed successfully in this workspace. The Dashboard development server reached Ready, but agent-browser 0.38.2 failed before opening Chromium because the workspace denies Unix socket binding (EPERM). An independent workspace socket probe reproduced the denial. Browser installation also encountered an untrusted certificate issuer; TLS verification was not disabled. No screenshot, DOM interaction, keyboard/mobile flow or visual assertion succeeded. The local verification sessions were stopped and ephemeral grants removed. Browser certification remains BLOCKED until an authorized browser-capable environment actually executes the checks.
