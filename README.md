# PlexonPanel 5.0

A clean-slate Next.js App Router dashboard over the retained Protocol 3 core. Root AGENTS.md and SKILL.md define the visual and backend contract.

Use Node 24: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, then `npm start`. Set the public relay origin with NEXT_PUBLIC_PLEXON_RELAY_URL (legacy VITE_PLEXON_RELAY_URL is accepted). The nonce CSP allowlists the current tonimserver.ddns.net HTTPS/WSS origin; coordinate any origin change with the CSP.

All presentation lives under src/ui: five surface depths, four KPI visualization footers, independent-source Telemetry Studio, virtual parsed console, reviewed mutations, eight routes, pairing and UUID inspection. The eight original preferences and authorization/target contracts remain intact. Console, chat, commands and control snapshots are never persisted in the browser; the IndexedDB migration purges old control caches.

Development fixtures use ?fixture=healthy|stale|skew|partial|stopped|offline|denied and never operate a server. /dev/surfaces and /dev/primitives provide visual proofs. Production ignores those fixture/gallery switches.

Run `node scripts/v5-browser.mjs` after installing Playwright Chromium, or set CHROME_PATH. EVIDENCE_DIR defaults to artifacts/v5. The script self-starts its server and covers every route at all requested sizes, review/pairing, UUID inspection, volatile history, chart fill/motion preferences, state fixtures, three accents and both themes. `node scripts/v5-production.mjs` checks the built application. Verification-only CI and disabled Git-triggered deployment are included.

Read docs/V5_IMPLEMENTATION.md and the matched backend docs/V5_SESSION_STORE_AND_PERIODIC_BACKUPS.md for migration and real-data adaptations. This handoff includes source, matched JARs, hashes, visual evidence and executed receipts. Live VPS/relay/RCON/Drive scheduling, failure recovery, restore/rollback and ARM64 runtime still require environment certification. Nothing is deployed by this handoff.
