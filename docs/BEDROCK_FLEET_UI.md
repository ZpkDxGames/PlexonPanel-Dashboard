# Bedrock Fleet UI — staged integration

Status: **development branch only**. These UI changes do not register a server or deploy a Bedrock Host.

## Design

Existing fleet cards are Paper-focused: they show TPS and JVM heap. A Bedrock Host must emit a **signed, explicitly declared** `edition: "BEDROCK"` before a card may show Bedrock presentation. Existing legacy Paper plugin identities continue to render as Java. Edition must not be guessed from instance names, versions or user-controlled labels.

This branch adds `src/ui/bedrock/edition.ts` and uses it in `src/ui/routes/Fleet.tsx`:

- Paper/legacy: existing TPS, Players, JVM Heap presentation unchanged.
- Explicit Bedrock: Container CPU, Players, Container Memory; no JVM/TPS labels.
- Container CPU/memory come only from `state.service.containerCpuPercent`, `state.service.containerMemoryBytes`, plus timestamp `state.service.containerStatsCapturedAt`.
- Timestamp missing, stale (>30 seconds) or implausibly future: CPU/memory unavailable (`—`), never zero.
- The player count must be separately corroborated by the Bedrock Host; an online container alone cannot prove a Bedrock server or a player count is available.
- Existing `ready.server.minecraftVersion` supplies the display version only once the Host has validated it.
- No new direct browser-to-Docker or browser-to-VPS API.

## Implementation dependencies

1. Design and audit a root-owned, exactly-container-pinned local Docker broker; keep Docker socket inaccessible to the browser-facing Host.
2. Introduce Bedrock Host Ed25519 identity, standalone owner enrollment and relay HOST_ONLY room acceptance. The existing relay currently assumes Paper-bound authorization; do **not** spoof Paper.
3. Validate signed edition and runtime telemetry fields at the boundary; route through the existing per-server session and fleet adapter without changing the action contract unsafely.
4. Add a Bedrock-only inspection/status fixture and end-to-end tests. The UI branch alone will not show a new server until relay enrollment exists.
5. Phase lifecycle, console, allowlist, backups and settings separately behind scoped capabilities.

## Verification

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and the project's structural checks. The new `tests/bedrock-edition.test.ts` covers explicit edition, legacy fallback, fresh stats and stale/invalid values.

## Release policy

No changes to production `main`, live Vercel deployment, existing Paper session code, relay, Docker container or VPS services until staging and explicit approval. Read backend contract `ZpkDxGames/PlexonPanel/docs/BEDROCK_HOST_INTEGRATION.md` from the matching development branch.
