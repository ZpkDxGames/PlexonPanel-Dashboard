# PlexonPanel Command Center — progress

Updated: 2026-10-11 UTC

## Done

- Phase 1 discovery: read the binding build instructions and the required legacy architecture, contract, capability, adapter and test references.
- Pinned the inspected Dashboard candidate, Dashboard production and Core commits.
- Defined frontend boundaries, route map, dependency plan and the clock-skew presentation decision.
- Phase 2 foundation: React/Vite/TypeScript scaffold, pinned dependencies, lazy hash routes, responsive shell, bundled fonts, themes, motion foundation, Vercel headers and integration-only adapter import.
- Adapter contract suite: 24/24 tests pass after import.
- Phase 3 data layer: source/freshness selectors, truthful metric formatting, preference store, negotiated capability gates and a shared bound-action review/result dialog.
- Data-layer suite: 27/27 tests pass.
- Phase 4 core pages: Fleet, Overview and Performance are implemented.
- Rendered design proof inspected on the temporary Vercel preview in dark and light themes, including disconnected, healthy-fixture and +12 second clock-skew states. Findings are recorded in `docs/VISUAL_REVIEW.md`.
- The yellow page-wide clock warning is replaced by compact source-health metadata; received-at freshness remains authoritative.
- Phase 5 Players: searchable roster, UUID skin chain with deterministic fallback, detail pane, capability-aware UUID-bound actions, validated command templates and a typed LuckPerms tier-B builder.
- Players validation: 30/30 tests and production build pass.
- Phase 6 Console & Chat: bounded ANSI SGR, section-code and MiniMessage parsing, fixed-column virtual console, search/level filtering, pause/clear/export, reviewed command/chat dispatch and plugin inventory/reload.
- Console validation: 35/35 tests and production build pass; parser tests include malformed and adversarial input.
- Phase 7 Operations: strict backup preflight and durable status, archive inventory/actions, device authority and audit views, relay/pairing settings, local theme/density/motion/time-zone controls, skin-provider disclosure and build diagnostics.
- Operations validation: 35/35 tests and production build pass.
- Phase 8 polish: responsive operational layouts, skip navigation, labelled native review dialog, reduced-motion/density controls, long-list containment and executable browser/performance harnesses.
- Performance check: initial route JavaScript 125,500 gzip bytes against 184,320-byte budget; passed.
- Automated Playwright/axe check: not executed because no Playwright Chromium runtime was installed and the browser download returned an invalid zero-byte archive. The harness remains in `scripts/browser-check.mjs`.
- Phase 9 documentation: design system, capability matrix, backend contracts, verification, performance, architecture, visual review, README and migration/rollback notes are present.
- Security check: production dependency audit reports 0 vulnerabilities; unsafe rendering/evaluation source scan reports no matches.
- Phase 10 deployment and report: the owner-private Site was published, a separate temporary Vercel QA preview was deployed, and Overview, Performance, Players, Console, Chat, Plugins, Backups, Access and Settings were inspected in the rendered browser. No inspected route overflowed horizontally and no application-origin console warning or error was observed.
- Production relay boundary diagnosis: the standalone relay is healthy on protocol 3, allows the production dashboard origin, and reports two rooms with live agents. The dashboard CSP was corrected to allow exactly `https://tonimserver.ddns.net` and `wss://tonimserver.ddns.net`.
- Production CSP rollout: GitHub `main` commit `8afe81d2d7887de2f0b5d1ab581d5d7458736a32` deployed successfully to Vercel as `dpl_CtGDpg8UZwPyppeFhaZQx5bSrDvK`. The live response header contains both exact relay origins, and the rendered Settings workspace reports the same commit and deployment relay URL with no application-origin console errors.
- Pairing UX review: the protocol-3 claim, same-relay WebSocket validation, IndexedDB credential persistence and signed-session transition are retained; dedicated contract coverage now exercises both accepted and cross-relay responses.
- First-run experience: application startup now renders immediately into an initialization-aware 2.8-second splash, then routes browsers with no valid pairing to a focused device-name and one-time-code page. Existing paired users proceed to the dashboard; fixture routes remain available for development verification.
- First-run validation: 41/41 tests pass, production build passes, and initial-route gzip is 127,032 bytes against the 184,320-byte budget.

## In progress

- Production rollout and rendered inspection of the first-run pairing experience.

## Next

1. Inspect the deployed splash and pairing gate at desktop and mobile sizes.
2. Generate a fresh TonimSMP server-local code and pair a least-privilege browser device.
3. Run authenticated Paper/Host telemetry and action acceptance checks.

## Decisions

- Project directory: `/workspace/sites/plexonpanel-command-center`; independent Git history.
- Visual presentation is new. Legacy UI code, layouts, CSS, navigation and markup will not be copied.
- Integration-only adapter modules may be copied from the pinned Dashboard candidate with provenance retained.
- The user explicitly removed the Configuration/files workspace. File editing remains available from the operator's own PC; the new navigation will not expose file mutation controls.
- Clock skew remains visible but becomes a compact source-health detail. It will not use a page-wide yellow warning when current samples are still usable.
- Production data is empty until a real session supplies it. Development fixtures are labeled and dispatch-disabled.
- The production CSP permits only self plus the verified relay origins `https://tonimserver.ddns.net` and `wss://tonimserver.ddns.net`; broad network wildcards are not accepted.
- Node is pinned to the Vercel-supported `24.x` major so a future Node major cannot silently change the build.
- Zero valid credentials is a top-level product state, not an empty Fleet page. The operational shell is withheld until a pairing exists; adding subsequent servers remains available from Settings.
- The splash has a 2.8-second minimum but also waits for browser-storage initialization, preventing an incorrect onboarding flash on returning paired browsers.

## Open questions

- A fresh TonimSMP pairing is required because its previous server-side pairing was disconnected. The code must be generated server-side after the CSP deployment.

