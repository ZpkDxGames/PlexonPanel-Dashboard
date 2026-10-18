> Historical evidence for the prior release. The owner rejected that visual design; see VISUAL_REBUILD_DIRECTIVE.md and VISUAL_REBUILD_VERIFICATION.md for the current sidebar rebuild.

# PlexonPanel 5.0 verification

Date: 2026-10-17. Scope: local implementation and release candidate packaging, not deployed production certification. Protocol3, configuration schema5, Java25 and Node24 are retained. See PARITY_AND_CHANGE_AUDIT.md, ROLLOUT_AND_ROLLBACK.md, package SOURCE_IDENTITY.json and verification/ evidence.

## Executed checks

| Check | Result | Evidence and boundary |
| --- | --- | --- |
| Java test/check + both JARs | PASS | 316 tests: Paper47, Host179, protocol90; zero failures/errors/skips |
| Java Javadoc | PASS | Gradle javadoc; cached final task outputs are reported honestly |
| TypeScript and unit/contracts | PASS | npm run check: type-check plus70 tests, zero failures/skips |
| Browser route matrix | PASS | 32 combinations: eight views ×1440×900/390×844 ×dark/light; zero page errors, horizontal overflow or Axe WCAG A/AA violations; Overview height <6500px |
| Interaction/state checks | PASS | stopped/offline/denied/stale/skew/partial; mobile large text/spacious, 44px navigation targets, exact prepared target, focus trap/restoration and G3 shortcut |
| Actual SQLite browser flow | PASS | Java25 JDBC/store through loopback synthetic relay; OTP pairing, history/reload, presence, boot reset, scope reduction, no operational browser storage and exactly-once reviewed mutation |
| Next production build | PASS | Dynamic App Router build, all eight routes, no-store nonce CSP, exact relay origin |
| Production workload | PASS | Intercepted production transport; 8192 raw captures, 2500 console rows, 11 mounted canvases; visible charts redraw, offscreen data remains retained |
| Polkit rule contract | PASS | 45 executed authorization cases; production Polkit not contacted |
| Read-authority filesystem contracts | PASS / BLOCKED | Actual ACL/FD/symlink/hardlink/lock tests pass. Multi-UID isolation attempted but container UID mapping rejects disposable chown (EINVAL); must execute in privileged disposable CI |
| Backup read bridge | PASS | Existing Python contract script exit0 |
| systemd unit syntax | PASS | systemd-analyze verify fleet units; no services started |
| Host package portability | PASS / NOT_EXECUTED | Java25 manifest/classes and exact four approved SQLite Linux payloads; incomplete/foreign payload rejection. JDBC executed on x64 only; native ARM64/musl execution pending CI |
| Full diff whitespace | PASS | Both repository diffs checked before packaging |
| Production HTTP/CSP | PASS | Fresh per-request nonce on Next bootstrap scripts, exact HTTPS/WSS origin, no eval, no-store HTML, no powered-by header |

The benchmark reports CDP main-thread work per125ms observation window (p95 target<16ms), RAF timing, long tasks and page errors. It does not assert every frame below16ms, physical-device performance, or React commit latency. The initial reconstructed production run missed at16.713ms; source-clock-aware redraw, deferred offscreen projection and lazy source columns eliminated redundant work without dropping raw points or reducing cadence. A later parity run missed at19.061ms and is also retained; final acceptance uses the unprofiled current-source result JSON. Both the initial failure and final measurement are retained in the package.

## Installation checks not executed

Actual signed relay/Caddy routing, live Paper26.2 capture, journal namespace delivery, systemd/Polkit lifecycle, RCON affirmation/countdown, isolated rclone OAuth refresh, Google Drive remote integrity/promotion, upload outage/recovery, scheduled cold backup, native ARM64, physical/mobile assistive technologies, long-running soak, rollback, and Vercel deployment/authorized origin are NOT_EXECUTED. The repository release-gate JSON contains historical coordination references and cannot certify this candidate. No credentials, allowlists, VPS units or remote branches were changed. This is a concrete implementation and review package, not an installation receipt.

All browser fixtures are clearly development-only and blocked from reaching operational services. Production isolation is checked on built browser assets. The production benchmark installs its synthetic transport from the test context; the application contains no production fixture entry point.
