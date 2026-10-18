> Historical evidence for the prior release. The owner rejected that visual design; see VISUAL_REBUILD_DIRECTIVE.md and VISUAL_REBUILD_VERIFICATION.md for the current sidebar rebuild.

# PlexonPanel 5.0: Host session storage, scheduled cold backups and Next.js Workbench

The previous dashboard retained operational console/chat state in IndexedDB and used the Vite shell, while cold backups exposed only manual initiation. This change moves current-boot history to private Host SQLite/atomic JSON, adds opt-in periodic Drive cold backups through the existing Host workflow, and replaces the entry shell with eight Next.js App Router views using Tailwind/Radix, virtual lists and synchronized uPlot telemetry.

Minecraft InvocationID changes reset console, chat and player-session history and notify the browser. A Host restart during the same invocation retains it. Cursor/search/severity queries read Host SQL, and a browser reload re-queries that source without restoring operational web caches. Presence/history limits and missing evidence remain explicit.

Manual and scheduled backups share node exclusion, preflight, persisted warnings, save-flush, fixed-unit stop proof, verified archive/upload/promotion, local retention and restart recovery. Scheduling defaults to disabled. Zero-minute manual initiation requires fixed RCON proof of no players. Mutations retain exact target capture, confirmation, scoped capability intersection and no automatic retry.

All eight views retain their operational controllers. The new shell adds a mobile drawer, command palette and source/boot ribbon. Charts keep source clocks/epochs and raw retention; deferred offscreen projection and unchanged-producer reuse avoid redundant work. The inspected evidence table excludes inserted visual gap timestamps while preserving actual missing observations.

Local verification: 316 Java tests, 70 TypeScript contracts/type-check, Java Javadoc/JAR packaging, Next production build, 32 browser route/theme/viewport cases, seven interaction/state cases, actual Java SQLite browser flow, production workload and nonce/no-store isolation checks. Exact results and local baseline/head identities are in the review package; they are not remote CI or installation receipts.

The relay implementation is absent. Current matched CI, native ARM64/musl execution, live systemd/journal/RCON/Drive checks, Vercel origin acceptance, long soak, physical assistive-technology checks and rollback remain unexecuted. Multi-UID ACL isolation was blocked by this container's UID mapping. No branch was pushed, PR opened, merge performed or deployment started. Existing no-deploy guards remain. See RELEASE_VERIFICATION.md and ROLLOUT_AND_ROLLBACK.md, including the v2 IndexedDB rollback requirement.
