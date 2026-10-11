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

## In progress

- None.

## Next

1. Add the final preview HTTPS origin to the relay allowlist and its matching WSS origin to `connect-src`.
2. Set `VITE_PLEXON_RELAY_URL`, deploy, then generate a fresh server-local code and pair a least-privilege device.
3. Run the live acceptance checks listed in `docs/VERIFICATION.md`; promote only after an explicit decision.

## Decisions

- Project directory: `/workspace/sites/plexonpanel-command-center`; independent Git history.
- Visual presentation is new. Legacy UI code, layouts, CSS, navigation and markup will not be copied.
- Integration-only adapter modules may be copied from the pinned Dashboard candidate with provenance retained.
- The user explicitly removed the Configuration/files workspace. File editing remains available from the operator's own PC; the new navigation will not expose file mutation controls.
- Clock skew remains visible but becomes a compact source-health detail. It will not use a page-wide yellow warning when current samples are still usable.
- Production data is empty until a real session supplies it. Development fixtures are labeled and dispatch-disabled.
- The checked-in CSP defaults `connect-src` to self only. The final Vercel target must add only the exact configured relay HTTPS and WSS origins when `VITE_PLEXON_RELAY_URL` is supplied; broad network wildcards are not accepted.
- Node is pinned to the Vercel-supported `24.x` major so a future Node major cannot silently change the build.

## Open questions

- None blocking the replacement candidate. Live relay origin, new-origin allowlisting and a fresh least-privilege pairing remain deployment acceptance inputs.

