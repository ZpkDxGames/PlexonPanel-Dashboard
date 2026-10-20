---
name: plexonpanel-v6-fullstack-durability-and-polish-architect
description: Binding execution spec for the PlexonPanel v6.0 full-stack release. Host Companion durability upgrades (4-gate non-throwing preflight, LOCAL_ONLY cold backups, one-click recovery resolve), the Obsidian Durability Workbench on /backups, and cross-dashboard polish (readout clipping, countdown pill, click-to-inspect player). Use for any work on ZpkDxGames/PlexonPanel or ZpkDxGames/PlexonPanel-Dashboard that targets v6.0 on top of dashboard commit bd6efa6.
---

# PlexonPanel v6.0 — Full-Stack Durability & Polish Release

Audience: GPT-6.1 Sol, executing across two repositories.

| Repo | Stack | Baseline |
|---|---|---|
| `ZpkDxGames/PlexonPanel-Dashboard` | Next.js App Router, React 19, TypeScript, Tailwind, Vercel | `bd6efa6` (v5.3 "The Obsidian Mission Deck") |
| `ZpkDxGames/PlexonPanel` | `agent/` Java 25 Paper 26.x plugin and `host-agent/` Java 25 Linux VPS Host Companion | current `main` |

---

## How to read this document

1. **Contracts are binding; identifiers marked `⟨BIND⟩` are not.** The code below was written against the described architecture, not against a checkout. Every `⟨BIND⟩` is a symbol, path or signature that you MUST match to the real one found in Phase 0. Never invent a symbol silently, and never rewrite a working abstraction to fit this document. Adapt this document to the repo.
2. **Behavior, JSON field names, error codes, invariants and test assertions are normative.** Variable names, helper names and file-internal structure are illustrative.
3. **Stage numbering is derived, never hardcoded.** The prose says "14 stages" and "Stage 6 = Stop service" (observed live: job `6efb490a-65c2-4d17-b0f0-4536d0524d42`). The stage names listed in §1.2 are the *intended* order, but the Java stage enum is the single source of truth. Derive ordinals, labels and the off-site stage range from it (see §1.2 and §2.1). If the enum disagrees with this document, the enum wins and you record the delta in your report.

---

## Phase 0 — Recon (read-only, mandatory, before the first edit)

Run these, then produce a **Binding Table** (`⟨BIND⟩ name → real symbol/path`) at the top of your final report.

```bash
# Dashboard repo
git rev-parse --short HEAD                                  # expect bd6efa6
cat .purge/core-sha256.json | head -40                      # the 27 locked files
grep -n "core-sha256\|verify" package.json                  # how the hash check / structure check run
grep -rn "maintenance.recovery.resolve\|backup.preflight\|provider.test\|backup.full.retry-upload\|backup.create\|maintenance.full-backup" src
grep -rn "readout-bar" src
grep -rniln "fixture" src/ui scripts | head                 # existing fixture/mock-host mechanism for tests
sed -n '1,120p' src/ui/bindings/view-sync.ts
sed -n '1,200p' src/ui/routes/Backups.tsx
sed -n '1,120p' src/ui/shell/MissionControlHeader.tsx
grep -rn "PpSelect\|\.pp-seg\|<Dialog" src/ui | head -20   # reuse these, do not re-invent

# Host repo (host-agent/)
git rev-parse --short HEAD
grep -rn "RECOVERY_REQUIRED\|recoveryRequired" host-agent/src
grep -rn "uploadOffsite" host-agent/src
grep -rn "preflightFailure\|class OperationFailure" host-agent/src
grep -rn "maintenance.recovery.resolve\|backup.preflight\|provider.test\|backup.full.retry-upload" host-agent/src
grep -rn "enum .*Stage\|STOPPING_SERVER" host-agent/src       # the authoritative stage enum
```

**Phase 0 questions you must answer in the report:**

- Does the locked adapter (`src/adapter/**`) pass action params through untouched, or validate them with a strict schema? (Decides whether `destinationMode`, `testProvider`, `acknowledgeRestore` can be sent without touching locked files; see §0.4.)
- Does `maintenance.status` already expose a countdown (`countdownState`, remaining seconds or end time)? What are its real field names?
- What is the existing segmented-control component or class (used by `Focus / Split` and `1m / 5m / 15m`)? Reuse it.
- What are the real names of the stage enum values and their count?

**Hard stop conditions.** Stop and report, do not improvise, if:
- `git rev-parse` of either repo is not the stated baseline and the diff is not trivially explainable.
- A required change would modify any of the 27 locked files (§0.4 has the only allowed escalation path).
- A structural invariant that passed at baseline fails and you cannot fix it inside the files this spec allows you to touch.

---

## §0. Preservation & Architectural Laws

### 0.1 Preserved from v5.3 (`bd6efa6`) — ZERO purge

You MUST NOT delete, move or rewrite wholesale: `src/ui/**` or `app/**`. Specifically these keep working and keep their current behavior and markup, except where a section below names a surgical change:

- `AppShell`, `CompactRail`, `MissionControlHeader` (surgical change: §3.2), `AuthorityLedgerPill`
- `InstrumentDeck` (4-cell top deck on `/overview`)
- `TelemetryStudio` (`Focus` / `Split`, 1 series per stage chart)
- `PerformanceWorkbench` (2-tier 9-lane analyzer; surgical change: `.pp-readout-bar` only, §3.1)
- `PlayerEventsDock` and `player-events.ts` (unified boot event stream; surgical change: clickable rows, §3.3)
- Custom `<PpSelect>` and `useViewSync()` (`"plexon:view-sync"` persistence; surgical change: one new field, §3.3)

### 0.2 Nesting Law (`noNestedBoxes`)

Inside any `.pp-pane` or `.pp-deck`, every cell, ribbon, band or banner uses `border-radius: 0` and `1px` hairlines (`border-right` / `border-bottom` / `border-top`). **Never** a rounded, fully-bordered box nested in a pane. A tinted band is a flush full-width strip with hairline top/bottom and at most a 2px left accent. Status markers are dots (`.pp-state`), not bordered chips.

### 0.3 Badge budget and header law

- `PAPER` badge count `<= 1`, `Live` badge count `<= 2` per page.
- `header[role="banner"]` height is exactly `56px` in every state (including with a countdown pill, §3.2).
- Zero native `<select>` anywhere. Zero inline `.gate-reason` paragraphs anywhere. On `/backups` additionally zero native `<input type="checkbox|number|time">` (§2.4). Gate reasons live in the preflight ribbon cell text, in `aria-describedby` tooltips and in the recovery band, never in a `<p class="gate-reason">`.
- New elements must not reuse the class or `data-*` selector the badge-budget check counts. The countdown pill and `.pp-state` dots are NOT badges, and must never contain the word "Live".

All **25 existing structural invariants** MUST still pass. You may *add* invariants (§4.3); you may not weaken or delete one.

### 0.4 Locked core — 27 files, SHA-256 frozen

`src/adapter/**`, `src/presentation/**`, `src/store/**`, `src/lib/**` (listed in `.purge/core-sha256.json`) are read-only.

- New UI-side logic goes in `src/ui/bindings/**` (new files allowed) and `src/ui/**`.
- **Allowed escalation path (only if Phase 0 proves the adapter rejects new params):** do NOT edit the locked file. Instead stop, report the exact file and the minimal diff needed, and wait for explicit user approval, which also requires regenerating `.purge/core-sha256.json` in a separate, clearly labelled commit.
- Verify at the end with the repo's existing core-hash check (the script found via `grep core-sha256 package.json`). It MUST report zero drift.

### 0.5 Compatibility law (Host and Dashboard deploy independently)

The Dashboard ships on Vercel; the Host runs on a VPS. All Host changes are **additive**: new optional params, new response fields, no removed or renamed field. The Dashboard MUST tolerate an **old Host** (no `localBackupReady` in the preflight response, no `destinationMode` support): in that case render the legacy single-destination flow, hide the `Local VPS Only` option, and show the ribbon's provider cell as "Host update required for local backups". Deploy order: Host first, Dashboard second.

### 0.6 Security and safety laws

- Validate `destinationMode` server-side (enum parse, reject unknown with `INVALID_DESTINATION_MODE`). Never trust the UI.
- Never log or return rclone tokens, config contents or credentials. `remote` is the remote name and path only.
- `maintenance.recovery.resolve` MUST NOT clear a *restore* recovery (`restoreRecoveryRequired`) merely because Minecraft is online. A half-applied restore can leave the world inconsistent, and "server is up" is not evidence it is intact. See §1.4.
- Every state-mutating action keeps its existing scope and audit logging. Do not add new scopes without need; `maintenance.recovery.resolve` is already scoped (`scopes.ts:111`).

### 0.7 Work order and commit hygiene

1. Phase 0 recon → Binding Table.
2. Host (`host-agent/`): §1, with tests, green `./gradlew test check`.
3. Dashboard pure logic (`src/ui/bindings/*`) + unit tests.
4. Dashboard views: §2, then §3.
5. §4 gates, then the report.

One commit per numbered item above, per repo, conventional messages (`feat(host): …`, `feat(ui): …`, `fix(ui): …`, `test: …`). Do not push, do not force anything, do not bump the version beyond `6.0.0` in the files that already carry the version string.

---

## §1. Host Companion (`host-agent`, Java 25) — v6.0 Durability Upgrades

Java 25 stable features only (records, sealed types, pattern-matching `switch`, virtual threads). **No preview APIs** (`StructuredTaskScope` is still preview; use `Executors.newVirtualThreadPerTaskExecutor()`).

Keep the package of each existing file. Where the doc says `⟨BIND⟩`, match the real signature.

### 1.1 Structured, non-throwing preflight: `FullBackupPreflight`

**Root cause being fixed:** `check()` currently throws on the first failed condition (`!provider.get("configured")` → `RCLONE_UNAVAILABLE`) *before* scanning `serverRoot` or measuring disk, so the operator never learns whether the local backup would have worked, and the Dashboard shows one generic message.

**New behavior:**

- `inspect(settings, freshProvider)` never throws for a gate failure. It evaluates **all four gates independently** and returns a `PreflightReport`.
- `check(settings, requireRemote)` calls `inspect`, then throws **only after all gates are evaluated**, choosing the failing gate by priority: `recovery` > `source` > `storage` > `provider` (provider only when `requireRemote`).
- `localBackupReady = !recoveryRequired && source READY && storage READY`.
- `offsiteBackupReady = localBackupReady && provider CONNECTED`.
- The provider gate runs on a virtual thread in parallel with the source scan and has a short TTL cache (30 s) so UI polling cannot hammer rclone. `freshProvider=true` bypasses the cache (the "Test Drive" and "Re-run preflight" buttons, and any real backup start).

```java
// package ⟨BIND⟩ — keep the package of the existing FullBackupPreflight.java
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.function.Predicate;

public final class FullBackupPreflight {

    public enum Readiness { READY, FAILED }
    public enum ProviderState { CONNECTED, NOT_CONFIGURED, FAILED }
    public enum ConfigState { ABSENT, UNREADABLE, OK }

    // ───────── gate results ─────────
    public record ActiveRecovery(String jobId, String kind, String stage, int stageIndex,
                                 String errorCode, String errorMessage, Instant updatedAt) {}

    public record RecoveryGate(boolean jobRecoveryRequired, boolean restoreRecoveryRequired,
                               ActiveRecovery active) {
        public boolean recoveryRequired() { return jobRecoveryRequired || restoreRecoveryRequired; }
    }

    public record SourceGate(Readiness state, long bytes, long entryCount,
                             List<String> includes, String errorCode) {}

    public record StorageGate(Readiness state, boolean backupRootWritable, long usableBytes,
                              long requiredBytes, String errorCode) {}

    public record ProviderGate(ProviderState state, String provider, String remote,
                               String errorCode, String message, Instant testedAt) {}

    public record PreflightReport(RecoveryGate recovery, SourceGate source,
                                  StorageGate storage, ProviderGate provider) {

        public boolean localBackupReady() {
            return !recovery.recoveryRequired()
                && source.state() == Readiness.READY
                && storage.state() == Readiness.READY;
        }

        public boolean offsiteBackupReady() {
            return localBackupReady() && provider.state() == ProviderState.CONNECTED;
        }

        /** Flat JSON shape consumed by the Dashboard. Keys are a public contract (§2.1). */
        public Map<String, Object> toMap() {
            var m = new LinkedHashMap<String, Object>();
            m.put("recoveryRequired", recovery.recoveryRequired());
            m.put("jobRecoveryRequired", recovery.jobRecoveryRequired());
            m.put("restoreRecoveryRequired", recovery.restoreRecoveryRequired());
            if (recovery.active() != null) {
                var a = recovery.active();
                var j = new LinkedHashMap<String, Object>();
                j.put("jobId", a.jobId());
                j.put("kind", a.kind());
                j.put("stage", a.stage());
                j.put("stageIndex", a.stageIndex());
                j.put("errorCode", a.errorCode());
                j.put("errorMessage", a.errorMessage());
                j.put("updatedAt", a.updatedAt() == null ? null : a.updatedAt().toString());
                m.put("recoveryJob", j);
            }
            m.put("sourceState", source.state().name());
            m.put("sourceBytes", source.bytes());
            m.put("entryCount", source.entryCount());
            m.put("includes", source.includes());
            m.put("sourceErrorCode", source.errorCode());
            m.put("storageState", storage.state().name());
            m.put("backupRootWritable", storage.backupRootWritable());
            m.put("usableBytes", storage.usableBytes());
            m.put("requiredBytes", storage.requiredBytes());
            m.put("storageErrorCode", storage.errorCode());
            m.put("providerState", provider.state().name());
            m.put("provider", provider.provider());
            m.put("remote", provider.remote());
            m.put("providerErrorCode", provider.errorCode());
            m.put("providerMessage", provider.message());
            m.put("providerTestedAt", provider.testedAt() == null ? null : provider.testedAt().toString());
            m.put("localBackupReady", localBackupReady());
            m.put("offsiteBackupReady", offsiteBackupReady());
            return m;
        }
    }

    // ───────── injectable probes (production wiring in HostMain; fakes in tests) ─────────
    public interface Probes {
        RecoveryGate recovery();                 // reads MaintenanceStateStore.recoveryRequired() ⟨BIND⟩
        Path serverRoot();
        List<String> includes();                 // backups.include
        Predicate<Path> excluded();              // MUST be the same predicate the archiver uses ⟨BIND⟩
        Path backupRoot();                       // backups.directory
        Path stagingRoot();
        long usableBytes(Path dir) throws IOException;
        ProviderProbe provider();
    }

    public interface ProviderProbe {
        boolean binaryPresent();
        ConfigState configState();
        String name();
        String remote();
        TestResult test(Duration timeout);       // wraps backups.testProvider(timeout) ⟨BIND⟩
    }

    public record TestResult(boolean ok, String errorCode, String message) {}

    // ───────── implementation ─────────
    private static final Duration PROVIDER_TTL = Duration.ofSeconds(30);
    private static final Duration PROVIDER_TEST_TIMEOUT = Duration.ofSeconds(10);
    private static final long SAFETY_MARGIN = 256L * 1024 * 1024;

    private record CachedProvider(ProviderGate gate, Instant at) {}

    private final Function<MaintenanceSettings, Probes> probesFor;   // ⟨BIND⟩ MaintenanceSettings type
    private final AtomicReference<CachedProvider> providerCache = new AtomicReference<>();

    public FullBackupPreflight(Function<MaintenanceSettings, Probes> probesFor) {
        this.probesFor = probesFor;
    }

    /** Never throws for a gate failure. Used by backup.preflight and by the periodic header poll. */
    public PreflightReport inspect(MaintenanceSettings settings, boolean freshProvider) {
        Probes p = probesFor.apply(settings);
        try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<ProviderGate> providerF = exec.submit(() -> providerGate(p, freshProvider));
            RecoveryGate recovery = safeRecovery(p);
            SourceGate source = scanSource(p);
            StorageGate storage = storageGate(p, source);
            return new PreflightReport(recovery, source, storage, await(providerF));
        }
    }

    /** Throws only after every gate has been evaluated. Priority: recovery > source > storage > provider. */
    public PreflightReport check(MaintenanceSettings settings, boolean requireRemote) {
        PreflightReport r = inspect(settings, requireRemote /* fresh test when a remote is mandatory */);
        assertReady(r, requireRemote);
        return r;
    }

    public static void assertReady(PreflightReport r, boolean requireRemote) {
        if (r.recovery().recoveryRequired()) {
            throw preflightFailure("RECOVERY_REQUIRED",
                "A previous maintenance job left the Host in a recovery state. Resolve it before starting a backup.");
        }
        if (r.source().state() != Readiness.READY) {
            throw preflightFailure(orDefault(r.source().errorCode(), "SOURCE_UNREADABLE"),
                "The server directory could not be scanned for backup.");
        }
        if (r.storage().state() != Readiness.READY) {
            throw preflightFailure(orDefault(r.storage().errorCode(), "STORAGE_UNAVAILABLE"),
                "The VPS backup storage is not usable (write access or free space).");
        }
        if (requireRemote && r.provider().state() != ProviderState.CONNECTED) {
            throw preflightFailure(orDefault(r.provider().errorCode(), "RCLONE_UNAVAILABLE"),
                orDefault(r.provider().message(),
                    "The running Host could not reach or validate the configured off-site provider."));
        }
    }

    // ── Gate 1
    private static RecoveryGate safeRecovery(Probes p) {
        try { return p.recovery(); }
        catch (RuntimeException e) {
            // Unknown recovery state must block (fail closed), not pass.
            return new RecoveryGate(true, false, null);
        }
    }

    // ── Gate 2
    static SourceGate scanSource(Probes p) {
        List<String> includes = List.copyOf(p.includes());
        Path root = p.serverRoot();
        if (root == null || !Files.isDirectory(root)) {
            return new SourceGate(Readiness.FAILED, 0, 0, includes, "SOURCE_ROOT_MISSING");
        }
        Path base = root.toAbsolutePath().normalize();
        var starts = new ArrayList<Path>();
        for (String inc : includes.isEmpty() ? List.of(".") : includes) {
            Path s = base.resolve(inc).normalize();
            if (!s.startsWith(base)) {
                return new SourceGate(Readiness.FAILED, 0, 0, includes, "SOURCE_PATH_ESCAPES_ROOT");
            }
            if (starts.stream().anyMatch(s::startsWith)) continue;     // already covered by an earlier include
            starts.add(s);
        }
        long[] bytes = {0}, files = {0};
        Predicate<Path> excluded = p.excluded();
        try {
            for (Path start : starts) {
                if (!Files.exists(start, LinkOption.NOFOLLOW_LINKS)) continue;   // optional include (dimension not generated yet)
                Files.walkFileTree(start, new SimpleFileVisitor<>() {           // does not follow symlinks
                    @Override public FileVisitResult preVisitDirectory(Path d, BasicFileAttributes a) {
                        return excluded.test(d) ? FileVisitResult.SKIP_SUBTREE : FileVisitResult.CONTINUE;
                    }
                    @Override public FileVisitResult visitFile(Path f, BasicFileAttributes a) {
                        if (a.isRegularFile() && !excluded.test(f)) { bytes[0] += a.size(); files[0]++; }
                        return FileVisitResult.CONTINUE;
                    }
                    @Override public FileVisitResult visitFileFailed(Path f, IOException e) throws IOException {
                        if (e instanceof NoSuchFileException) return FileVisitResult.CONTINUE; // live server rotated it mid-scan
                        throw e;
                    }
                });
            }
        } catch (IOException e) {
            return new SourceGate(Readiness.FAILED, bytes[0], files[0], includes, "SOURCE_UNREADABLE");
        }
        if (files[0] == 0) return new SourceGate(Readiness.FAILED, 0, 0, includes, "SOURCE_EMPTY");
        return new SourceGate(Readiness.READY, bytes[0], files[0], includes, null);
    }

    // ── Gate 3 — evaluated even when the source scan failed (writability and headroom are still reported)
    static StorageGate storageGate(Probes p, SourceGate source) {
        long required = source.state() == Readiness.READY
            ? (source.bytes() > Long.MAX_VALUE / 2 ? Long.MAX_VALUE : source.bytes() * 2) : 0L;   // archive + staging copy
        Path root = p.backupRoot(), staging = p.stagingRoot();
        try {
            if (!writable(root)) return new StorageGate(Readiness.FAILED, false, 0, required, "BACKUP_DIR_NOT_WRITABLE");
            long usableRoot = p.usableBytes(root);
            if (!writable(staging)) return new StorageGate(Readiness.FAILED, true, usableRoot, required, "STAGING_NOT_WRITABLE");
            long usableStaging = p.usableBytes(staging);
            boolean sameStore = Files.getFileStore(root).equals(Files.getFileStore(staging));
            long usable = sameStore ? usableRoot : Math.min(usableRoot, usableStaging);
            long need = required == 0 ? 0 : (sameStore ? required : source.bytes()) + SAFETY_MARGIN;
            if (required > 0 && usable < need) {
                return new StorageGate(Readiness.FAILED, true, usable, required, "INSUFFICIENT_DISK_SPACE");
            }
            return new StorageGate(Readiness.READY, true, usable, required, null);
        } catch (IOException e) {
            return new StorageGate(Readiness.FAILED, false, 0, required, "STORAGE_UNAVAILABLE");
        }
    }

    private static boolean writable(Path dir) {
        try {
            Files.createDirectories(dir);
            Path probe = Files.createTempFile(dir, ".preflight-", ".tmp");
            Files.deleteIfExists(probe);
            return true;
        } catch (IOException e) { return false; }
    }

    // ── Gate 4
    ProviderGate providerGate(Probes p, boolean fresh) {
        CachedProvider c = providerCache.get();
        if (!fresh && c != null && Duration.between(c.at(), Instant.now()).compareTo(PROVIDER_TTL) < 0) return c.gate();
        ProviderProbe pr = p.provider();
        Instant now = Instant.now();
        ProviderGate g;
        if (!pr.binaryPresent() || pr.configState() == ConfigState.ABSENT) {
            g = new ProviderGate(ProviderState.NOT_CONFIGURED, pr.name(), pr.remote(), "RCLONE_UNAVAILABLE",
                "Off-site provider is not configured on this Host.", now);
        } else if (pr.configState() == ConfigState.UNREADABLE) {
            g = new ProviderGate(ProviderState.FAILED, pr.name(), pr.remote(), "RCLONE_CONFIG_UNREADABLE",
                "The rclone configuration file exists but cannot be read.", now);
        } else {
            TestResult t = pr.test(PROVIDER_TEST_TIMEOUT);
            g = t.ok()
                ? new ProviderGate(ProviderState.CONNECTED, pr.name(), pr.remote(), null, null, now)
                : new ProviderGate(ProviderState.FAILED, pr.name(), pr.remote(),
                    orDefault(t.errorCode(), "PROVIDER_UNREACHABLE"),
                    orDefault(t.message(), "The running Host could not reach or validate the configured off-site provider."), now);
        }
        providerCache.set(new CachedProvider(g, now));
        return g;
    }

    private static ProviderGate await(Future<ProviderGate> f) {
        try { return f.get(); }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new ProviderGate(ProviderState.FAILED, null, null, "PREFLIGHT_INTERRUPTED", "Provider check was interrupted.", Instant.now());
        } catch (ExecutionException e) {
            return new ProviderGate(ProviderState.FAILED, null, null, "PREFLIGHT_INTERNAL_ERROR", "Provider check failed unexpectedly.", Instant.now());
        }
    }

    private static String orDefault(String v, String d) { return (v == null || v.isBlank()) ? d : v; }

    // preflightFailure(code, message) already exists in this class today ⟨BIND⟩: keep it, keep its OperationFailure type.
}
```

Notes for the implementer:
- If `OperationFailure` is a checked exception today, add `throws OperationFailure` to `check` and `assertReady`.
- Do **not** change the existing error codes (`RCLONE_UNAVAILABLE`, `RCLONE_CONFIG_UNREADABLE`, `RECOVERY_REQUIRED`); the Dashboard and audit logs key on them. New codes are additive: `SOURCE_ROOT_MISSING`, `SOURCE_PATH_ESCAPES_ROOT`, `SOURCE_UNREADABLE`, `SOURCE_EMPTY`, `BACKUP_DIR_NOT_WRITABLE`, `STAGING_NOT_WRITABLE`, `INSUFFICIENT_DISK_SPACE`, `STORAGE_UNAVAILABLE`, `PROVIDER_UNREACHABLE`, `PREFLIGHT_INTERNAL_ERROR`, `INVALID_DESTINATION_MODE`.
- `scanSource` MUST use the archiver's own exclusion predicate (and, if one exists, its include resolver). A preflight that counts different files than the archiver will lie about headroom.
- `safeRecovery` fails **closed**: if recovery state cannot be read, treat it as required.

#### `backup.preflight` handler (`HostMain.java`)

```java
case "backup.preflight" -> {
    boolean fresh = Boolean.TRUE.equals(params.get("fresh"));
    PreflightReport r = preflight.inspect(maintenance.settings(), fresh);
    var out = new LinkedHashMap<>(r.toMap());
    // Legacy keys kept so an older Dashboard still renders something sensible:
    out.put("ok", r.offsiteBackupReady());
    return out;
}
```

### 1.2 Destination mode: `DestinationMode` + `MaintenanceManager` + `HostMain`

`FullRestorePointManager.create(jobId, initiatedBy, automatic, emergency, settings, uploadOffsite)` **already supports `uploadOffsite = false`** (crash-safe, SHA-256 verified `restore-points/<backupId>.zip`). The only thing blocking local backups is the preflight and the manager's decision logic. Do not change `FullRestorePointManager`'s archive format.

```java
public enum DestinationMode {
    AUTO, DRIVE_AND_LOCAL, LOCAL_ONLY;

    public static DestinationMode parse(Object raw) {
        if (raw == null) return AUTO;
        String s = raw.toString().trim().toUpperCase(Locale.ROOT);
        if (s.isEmpty()) return AUTO;
        try { return valueOf(s); }
        catch (IllegalArgumentException e) {
            throw FullBackupPreflight.preflightFailure("INVALID_DESTINATION_MODE",
                "destinationMode must be AUTO, DRIVE_AND_LOCAL or LOCAL_ONLY.");   // ⟨BIND⟩ expose preflightFailure as package-visible static
        }
    }

    /** What a run will actually do. */
    public record Plan(DestinationMode requested, boolean uploadOffsite, boolean requireRemote, String fallbackReason) {
        public String effective() { return uploadOffsite ? "DRIVE_AND_LOCAL" : "LOCAL_ONLY"; }
    }

    public Plan plan(FullBackupPreflight.ProviderState provider, boolean allowLocalFallback) {
        return switch (this) {
            case LOCAL_ONLY      -> new Plan(this, false, false, null);
            case DRIVE_AND_LOCAL -> new Plan(this, true, true, null);
            case AUTO -> provider == FullBackupPreflight.ProviderState.CONNECTED
                ? new Plan(this, true, true, null)
                : allowLocalFallback
                    ? new Plan(this, false, false, "PROVIDER_" + provider.name())
                    : new Plan(this, true, true, null);          // preflight will then fail with the real provider code
        };
    }
}
```

Semantics (normative):

| Requested | Provider CONNECTED | Provider NOT_CONFIGURED / FAILED |
|---|---|---|
| `LOCAL_ONLY` | local only | local only |
| `DRIVE_AND_LOCAL` | Drive + local | **fail** with the provider's real error code |
| `AUTO` | Drive + local | local only **if** `allowLocalFallback`, else **fail** with the provider's real error code |

`allowLocalFallback` is a new boolean on `MaintenanceSettings.FullRestorePoint`, **default `false`** (so unattended scheduled backups behave exactly as before unless the operator opts in). Persisted JSON that lacks it MUST deserialize to `false`.

```java
// MaintenanceSettings.FullRestorePoint ⟨BIND⟩ — add component with a back-compat default
boolean allowLocalFallback   // missing in stored JSON → false
```

#### `MaintenanceManager` — starting a full backup

```java
// Replace the body that today calls preflight.check(settings, true) then restorePoints.create(..., true) ⟨BIND⟩
public Map<String, Object> startFullBackup(String actor, int countdownSeconds,
                                           DestinationMode requested, boolean automatic) {
    MaintenanceSettings settings = settings();
    boolean allowFallback = settings.fullRestorePoint().allowLocalFallback();

    // 1. Inspect once (fresh provider test unless LOCAL_ONLY), derive the plan, then assert.
    var report = preflight.inspect(settings, requested != DestinationMode.LOCAL_ONLY);
    var plan = requested.plan(report.provider().state(), allowFallback);
    FullBackupPreflight.assertReady(report, plan.requireRemote());     // synchronous, real error code to the caller

    // 2. Create the job as today, but persist the mode so the UI and history can show it.
    Job job = jobs.begin(actor, countdownSeconds, automatic);           // ⟨BIND⟩ existing job creation + maintenance lock
    job.put("destinationMode", requested.name());
    job.put("effectiveDestination", plan.effective());
    job.put("fallbackReason", plan.fallbackReason());

    // 3. Pipeline (existing crash-safe stage runner). Two additions marked ★.
    runStages(job, () -> {
        // Stage PREFLIGHT / COUNTDOWN / FINAL_SAVE run as today.
        // ★ Re-assert immediately BEFORE stopping the server. Disk or Drive may have changed during the countdown.
        var again = preflight.inspect(settings, plan.uploadOffsite());
        var plan2 = plan;
        if (plan.uploadOffsite() && again.provider().state() != FullBackupPreflight.ProviderState.CONNECTED && allowFallback
                && requested == DestinationMode.AUTO) {
            plan2 = new DestinationMode.Plan(requested, false, false, "PROVIDER_" + again.provider().state().name());
            job.put("effectiveDestination", plan2.effective());
            job.put("fallbackReason", plan2.fallbackReason());
        }
        FullBackupPreflight.assertReady(again, plan2.requireRemote());   // abort BEFORE STOPPING_SERVER, nothing mutated yet

        // STOPPING_SERVER → WAITING_FOR_STOP → ARCHIVING → HASHING → VERIFYING_LOCAL as today.
        var point = restorePoints.create(job.id(), actor, automatic, /*emergency*/ false, settings,
                                         plan2.uploadOffsite());          // ← the already-supported flag

        // ★ LOCAL_ONLY: off-site stages are SKIPPED, not failed. Record them so the rail can render them.
        if (!plan2.uploadOffsite()) job.put("skippedStages", offsiteStageOrdinals());   // derived from the enum, see below

        // STARTING_SERVER → VERIFYING_STARTUP as today (unchanged, crash-safe).
        return point;
    });
    return job.snapshot();
}
```

**Stage handling (normative, derive from the enum):**
- The intended order is `PREFLIGHT → COUNTDOWN → FINAL_SAVE → STOPPING_SERVER → WAITING_FOR_STOP → ARCHIVING → HASHING → VERIFYING_LOCAL → (off-site stages) → STARTING_SERVER → VERIFYING_STARTUP`, 14 stages in total. The live job shows `Stop service` at ordinal 6 of 14, so the real enum contains stages not named here (e.g. lock/announce stages). Use the enum.
- `offsiteStageOrdinals()` returns the ordinals of the stages strictly between `VERIFYING_LOCAL` and `STARTING_SERVER` in enum order. Do **not** hardcode "9–12".
- Expose the stage list to the Dashboard in `maintenance.status` / job snapshots as `stages: [{ index, key, label }]` and `skippedStages: number[]` (additive fields), so the rail never has to guess.
- A `LOCAL_ONLY` archive is stored with `verification: "VERIFIED_LOCAL"` and `offsite: false`; the stop → archive → start sequence and its crash recovery are otherwise identical to a Drive backup.

#### `HostMain` — action wiring

```java
case "backup.create", "maintenance.full-backup.create" -> {
    int countdown = intParam(params, "countdownSeconds", 300);              // ⟨BIND⟩ existing parsing helper
    var mode = DestinationMode.parse(params.get("destinationMode"));
    return maintenance.startFullBackup(actor, countdown, mode, /*automatic*/ false);
}
```

The scheduled-backup path calls `startFullBackup(..., DestinationMode.AUTO, true)`.

#### Promote to Drive (`backup.full.retry-upload`)

`VERIFIED_LOCAL` archives are uploaded later **without stopping Minecraft**. The action already exists; harden it:

```java
public Map<String, Object> promoteToDrive(String actor, String backupId) {
    var report = preflight.inspect(settings(), /*fresh*/ true);
    FullBackupPreflight.assertReady(new FullBackupPreflight.PreflightReport(
        new FullBackupPreflight.RecoveryGate(false, false, null),   // the archive is immutable; recovery state is irrelevant to an upload
        report.source(), report.storage(), report.provider()), /*requireRemote*/ true);
    if (jobs.hasRunning()) throw preflightFailure("JOB_RUNNING", "Another maintenance job is running.");
    var point = restorePoints.require(backupId);                        // ⟨BIND⟩
    restorePoints.rehashAndVerifyLocal(point);                          // re-verify SHA-256 before it leaves the VPS ⟨BIND⟩
    return restorePoints.uploadExisting(point, actor);                  // ⟨BIND⟩ existing retry-upload implementation
}
```

No maintenance lock, no server stop, no countdown.

### 1.3 Countdown visibility in `maintenance.status` (needed by §3.2)

`maintenance.status` MUST expose (additive, add only what is missing — Phase 0 tells you what exists):

```json
{
  "countdownState": "IDLE | ACTIVE",
  "countdownKind": "BACKUP | RESTART | STOP | null",
  "countdownRemainingSeconds": 258,
  "countdownEndsAt": "2026-10-19T23:44:18Z",
  "countdownTotalSeconds": 300,
  "recoveryRequired": false
}
```

`countdownRemainingSeconds` is the field the Dashboard prefers (immune to client clock skew). Broadcast `maintenance.status` on every state change (countdown start, cancel, finish, recovery change) in addition to the existing cadence.

### 1.4 One-click `maintenance.recovery.resolve` (+ optional auto-reconcile)

Keep the action name, scope and audit semantics. Behavior:

```java
public synchronized Map<String, Object> resolveRecovery(String actor, boolean acknowledgeRestore) {
    var gate = state.recoveryGate();                                         // ⟨BIND⟩ MaintenanceStateStore accessor
    if (!gate.recoveryRequired()) {
        return Map.of("resolved", false, "reason", "NOTHING_TO_RESOLVE");   // idempotent, no error
    }
    if (jobs.hasRunning()) {
        throw preflightFailure("RECOVERY_JOB_RUNNING", "A maintenance job is still running.");
    }
    // 1. The Host must be demonstrably healthy.
    var status = service.status();
    if (!"active".equals(status.get("state"))) {
        throw preflightFailure("RECOVERY_SERVICE_NOT_ACTIVE", "The Minecraft service is not active.");
    }
    if (!minecraftReady()) {                                                 // ⟨BIND⟩ existing minecraftReadiness check
        throw preflightFailure("RECOVERY_MINECRAFT_NOT_READY", "Minecraft is running but not ready yet.");
    }
    // 2. A half-applied RESTORE is never auto-cleared by "the server is up".
    if (gate.restoreRecoveryRequired() && !acknowledgeRestore) {
        throw preflightFailure("RESTORE_RECOVERY_REQUIRES_REVIEW",
            "A restore was interrupted. Review the world, then confirm explicitly.");
    }
    // 3. Mark the interrupted job FAILED, preserving the original error in history.
    var active = gate.active();
    if (active != null) {
        state.markFailed(active.jobId(), Map.of(                              // ⟨BIND⟩ must NOT overwrite the stored errorCode
            "originalErrorCode", String.valueOf(active.errorCode()),
            "resolvedBy", actor,
            "resolvedAt", Instant.now().toString(),
            "resolution", "RECOVERY_RESOLVED_BY_OPERATOR"));
    }
    state.clearRecovery(gate.restoreRecoveryRequired() ? "RESTORE" : "JOB");  // ⟨BIND⟩
    events.broadcast("maintenance.recovery.resolved",
        Map.of("jobId", active == null ? "" : active.jobId(), "resolvedBy", actor));
    events.broadcast("maintenance.status", statusSnapshot());                  // UI unlocks immediately
    return Map.of("resolved", true, "jobId", active == null ? "" : active.jobId());
}
```

HostMain: `case "maintenance.recovery.resolve" -> maintenance.resolveRecovery(actor, Boolean.TRUE.equals(params.get("acknowledgeRestore")));`

**Optional auto-reconcile (default OFF).** Behind a new setting `maintenance.autoReconcileRecovery` (default `false`): on Host boot, and every 30 s while `RECOVERY_REQUIRED` is latched, auto-resolve with `actor = "host:auto-reconcile"` only if **all** hold: the latched item is a *backup job* (never a restore), its failed stage ordinal is `<=` `STOPPING_SERVER` (server was never taken away from players, nothing was mutated), service `active` and Minecraft ready on **two consecutive checks ≥ 30 s apart**, and no job is running. Emit the same `maintenance.recovery.resolved` event. The 1-click button is the required deliverable; auto-reconcile is the optional extra.

### 1.5 Host tests (`./gradlew test check` MUST be green)

`FullBackupPreflightTest.java`:

```java
class FullBackupPreflightTest {
    @TempDir Path tmp;

    // Probes fake: builder with .recovery(...), .provider(...), .usable(long), writable dirs under tmp.
    // Provide FakeProbes in src/test/java next to this test.

    @Test void evaluatesAllGatesWhenRcloneUnconfigured() throws Exception {
        var p = FakeProbes.healthy(tmp).providerNotConfigured();
        var r = new FullBackupPreflight(s -> p).inspect(null, false);
        assertEquals(Readiness.READY, r.source().state());
        assertEquals(Readiness.READY, r.storage().state());
        assertEquals(ProviderState.NOT_CONFIGURED, r.provider().state());
        assertEquals("RCLONE_UNAVAILABLE", r.provider().errorCode());
        assertTrue(r.localBackupReady());
        assertFalse(r.offsiteBackupReady());
        assertTrue(r.source().bytes() > 0 && r.source().entryCount() > 0);
    }

    @Test void checkLocalOnlyPassesWithoutRclone() {
        var pf = new FullBackupPreflight(s -> FakeProbes.healthy(tmp).providerNotConfigured());
        assertDoesNotThrow(() -> pf.check(null, /*requireRemote*/ false));
    }

    @Test void checkRemoteFailsWithRealProviderCode() {
        var pf = new FullBackupPreflight(s -> FakeProbes.healthy(tmp).providerNotConfigured());
        var e = assertThrows(OperationFailure.class, () -> pf.check(null, true));
        assertEquals("RCLONE_UNAVAILABLE", e.code());
    }

    @Test void recoveryIsNeverMaskedByProvider() {
        var pf = new FullBackupPreflight(s -> FakeProbes.healthy(tmp).recoveryRequired().providerNotConfigured());
        var e = assertThrows(OperationFailure.class, () -> pf.check(null, true));
        assertEquals("RECOVERY_REQUIRED", e.code());
    }

    @Test void insufficientDiskIsReportedIndependentlyOfProvider() {
        var r = new FullBackupPreflight(s -> FakeProbes.healthy(tmp).usable(1024)).inspect(null, false);
        assertEquals("INSUFFICIENT_DISK_SPACE", r.storage().errorCode());
        assertFalse(r.localBackupReady());
    }

    @Test void sourceFailureStillReportsStorage() {
        var r = new FullBackupPreflight(s -> FakeProbes.healthy(tmp).missingServerRoot()).inspect(null, false);
        assertEquals("SOURCE_ROOT_MISSING", r.source().errorCode());
        assertEquals(Readiness.READY, r.storage().state());   // storage evaluated, not skipped
    }

    @Test void unreadableRecoveryStateFailsClosed() {
        var r = new FullBackupPreflight(s -> FakeProbes.healthy(tmp).recoveryThrows()).inspect(null, false);
        assertTrue(r.recovery().recoveryRequired());
    }

    @Test void providerResultIsCachedUnlessFresh() {
        var p = FakeProbes.healthy(tmp).providerConnected();
        var pf = new FullBackupPreflight(s -> p);
        pf.inspect(null, false); pf.inspect(null, false);
        assertEquals(1, p.providerTestCalls());
        pf.inspect(null, true);
        assertEquals(2, p.providerTestCalls());
    }

    @Test void toMapExposesContractKeys() {
        var m = new FullBackupPreflight(s -> FakeProbes.healthy(tmp).providerConnected()).inspect(null, false).toMap();
        for (var k : List.of("recoveryRequired","sourceState","sourceBytes","entryCount","includes","storageState",
                "backupRootWritable","usableBytes","requiredBytes","providerState","provider","remote",
                "localBackupReady","offsiteBackupReady"))
            assertTrue(m.containsKey(k), k);
        assertEquals(true, m.get("offsiteBackupReady"));
    }
}
```

`DestinationModeTest.java`: assert the table in §1.2 for all 3 modes × 3 provider states × `allowLocalFallback ∈ {true,false}`; `parse(null)`/`parse("")` → `AUTO`; `parse("nope")` → `INVALID_DESTINATION_MODE`; case-insensitive parse.

`MaintenanceFullBackupFailurePolicyTest.java` (extend the existing class):

```java
@Test void localOnlyCreatesVerifiedLocalArchiveWithoutRclone() {
    var h = MaintenanceHarness.withProviderNotConfigured(tmp);        // fake provider that THROWS if upload/test is called for LOCAL_ONLY
    var out = h.manager().startFullBackup("tester", 0, DestinationMode.LOCAL_ONLY, false);
    h.awaitJob(out);
    var point = h.restorePoints().latest();
    assertTrue(Files.exists(h.restoreDir().resolve(point.id() + ".zip")));
    assertEquals("VERIFIED_LOCAL", point.verification());
    assertFalse(point.offsite());
    assertNotNull(point.sha256());
    assertFalse(h.providerWasCalled());
    assertEquals("LOCAL_ONLY", h.job(out).get("effectiveDestination"));
    assertFalse(((List<?>) h.job(out).get("skippedStages")).isEmpty());
    assertTrue(h.serviceWasStoppedThenStarted());                       // full crash-safe path ran
}

@Test void autoFailsWithRealProviderCodeWhenFallbackDisabled() {
    var h = MaintenanceHarness.withProviderNotConfigured(tmp).allowLocalFallback(false);
    var e = assertThrows(OperationFailure.class,
        () -> h.manager().startFullBackup("t", 0, DestinationMode.AUTO, false));
    assertEquals("RCLONE_UNAVAILABLE", e.code());
    assertFalse(h.serviceWasStopped());                                  // nothing mutated
}

@Test void autoFallsBackToLocalWhenEnabled() {
    var h = MaintenanceHarness.withProviderNotConfigured(tmp).allowLocalFallback(true);
    var out = h.manager().startFullBackup("t", 0, DestinationMode.AUTO, false);
    h.awaitJob(out);
    assertEquals("LOCAL_ONLY", h.job(out).get("effectiveDestination"));
    assertEquals("PROVIDER_NOT_CONFIGURED", h.job(out).get("fallbackReason"));
}

@Test void driveDroppingDuringCountdownAbortsBeforeStop() {
    var h = MaintenanceHarness.withProviderConnected(tmp).providerDropsAfterCountdown().allowLocalFallback(false);
    var out = h.manager().startFullBackup("t", 5, DestinationMode.DRIVE_AND_LOCAL, false);
    h.awaitJob(out);
    assertEquals("FAILED", h.job(out).get("state"));
    assertFalse(h.serviceWasStopped());
}

@Test void recoveryResolveClearsWhenMinecraftActiveAndPreservesOriginalError() {
    var h = MaintenanceHarness.latchedRecovery(tmp, "6efb490a-65c2-4d17-b0f0-4536d0524d42", "STOP_TIMEOUT").minecraftActiveAndReady();
    var res = h.manager().resolveRecovery("tester", false);
    assertEquals(true, res.get("resolved"));
    assertFalse(h.state().recoveryRequired());
    var job = h.job("6efb490a-65c2-4d17-b0f0-4536d0524d42");
    assertEquals("FAILED", job.get("state"));
    assertEquals("STOP_TIMEOUT", job.get("originalErrorCode"));          // history preserved
    assertTrue(h.events().contains("maintenance.recovery.resolved"));
}

@Test void recoveryResolveRefusesWhenServiceInactiveOrNotReady() {
    var h = MaintenanceHarness.latchedRecovery(tmp, "j1", "STOP_TIMEOUT").serviceInactive();
    assertEquals("RECOVERY_SERVICE_NOT_ACTIVE",
        assertThrows(OperationFailure.class, () -> h.manager().resolveRecovery("t", false)).code());
    var h2 = MaintenanceHarness.latchedRecovery(tmp, "j1", "STOP_TIMEOUT").serviceActiveNotReady();
    assertEquals("RECOVERY_MINECRAFT_NOT_READY",
        assertThrows(OperationFailure.class, () -> h2.manager().resolveRecovery("t", false)).code());
}

@Test void restoreRecoveryNeedsExplicitAcknowledgement() {
    var h = MaintenanceHarness.latchedRestoreRecovery(tmp).minecraftActiveAndReady();
    assertEquals("RESTORE_RECOVERY_REQUIRES_REVIEW",
        assertThrows(OperationFailure.class, () -> h.manager().resolveRecovery("t", false)).code());
    assertEquals(true, h.manager().resolveRecovery("t", true).get("resolved"));
}

@Test void recoveryResolveIsIdempotent() {
    var h = MaintenanceHarness.clean(tmp);
    assertEquals(false, h.manager().resolveRecovery("t", false).get("resolved"));
}

@Test void promoteToDriveDoesNotStopServer() {
    var h = MaintenanceHarness.withLocalArchive(tmp).providerConnected();
    h.manager().promoteToDrive("t", h.restorePoints().latest().id());
    assertFalse(h.serviceWasStopped());
    assertTrue(h.uploaded());
}
```

If a harness (`MaintenanceHarness`, `FakeProbes`) does not exist yet, create it under `src/test/java` using the project's existing test fixtures as the starting point. Do not weaken production visibility more than package-private to make it testable.

---

## §2. R06 `/backups` — The Obsidian Durability Workbench

**Problem recap (from the live screenshot):** job `6efb490a…` stuck at *Stage 6 / 14 · Stop service* with `RECOVERY_REQUIRED`, `TonimSMP` online and healthy, no button to clear it; `Create full backup` disabled behind a generic tooltip that overlaps the `Restore points` header; the legacy hero ("R06 / DURABILITY — Restore with evidence."); native inputs in the schedule modal.

**Files:**

| File | Action |
|---|---|
| `src/ui/bindings/backups-model.ts` | NEW — pure types, normalizers, gate derivation (unit-tested) |
| `src/ui/bindings/maintenance.ts` | NEW — countdown/recovery hook shared by `/backups` and the header (§3.2) |
| `src/ui/routes/Backups.tsx` | REWRITE the view only. Keep every presentation selector and host call it uses today |
| `src/ui/styles/globals.css` | APPEND the v6.0 durability block (§2.5) |

Rules for the rewrite:
- Keep consuming the **existing presentation selectors** for job, schedule and restore points (they live in locked `src/presentation/**`). Only the preflight is new data (`backup.preflight` via the existing host-invoke path). Map them through a thin `useBackupsVm()` (`⟨BIND⟩`) so the view is testable.
- Reuse existing components: `PpSelect`, `Dialog`, the existing segmented control (the one behind `Focus / Split`), the existing confirmation flow for `Restore`. Do not create look-alikes.
- Remove the legacy hero (`R06 / DURABILITY` + `Restore with evidence.` + subtitle). The page opens directly on the pipeline pane, like `/overview` does.

### 2.1 Pure model: `src/ui/bindings/backups-model.ts`

```ts
// ─── Host contract (mirrors §1.1 PreflightReport.toMap) ───────────────────
export type Readiness = "READY" | "FAILED";
export type ProviderState = "CONNECTED" | "NOT_CONFIGURED" | "FAILED";
export type DestinationMode = "AUTO" | "DRIVE_AND_LOCAL" | "LOCAL_ONLY";

export interface PreflightView {
  legacyHost: boolean;                 // true when the Host predates v6.0 (no localBackupReady)
  recoveryRequired: boolean;
  jobRecoveryRequired: boolean;
  restoreRecoveryRequired: boolean;
  recoveryJob: null | {
    jobId: string; kind: string; stage: string; stageIndex: number;
    errorCode: string | null; errorMessage: string | null; updatedAt: string | null;
  };
  sourceState: Readiness; sourceBytes: number; entryCount: number; includes: string[]; sourceErrorCode: string | null;
  storageState: Readiness; backupRootWritable: boolean; usableBytes: number; requiredBytes: number; storageErrorCode: string | null;
  providerState: ProviderState; provider: string | null; remote: string | null;
  providerErrorCode: string | null; providerMessage: string | null;
  localBackupReady: boolean; offsiteBackupReady: boolean;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const bool = (v: unknown): boolean => v === true;
const rd = (v: unknown): Readiness => (v === "READY" ? "READY" : "FAILED");
const ps = (v: unknown): ProviderState =>
  v === "CONNECTED" || v === "NOT_CONFIGURED" ? v : "FAILED";

/** Defensive: tolerates old Hosts and partial payloads. Never throws. */
export function normalizePreflight(raw: unknown): PreflightView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const legacyHost = typeof r.localBackupReady !== "boolean";
  const j = r.recoveryJob && typeof r.recoveryJob === "object" ? r.recoveryJob : null;
  const recoveryRequired = bool(r.recoveryRequired);
  const sourceState = legacyHost ? "READY" : rd(r.sourceState);
  const storageState = legacyHost ? "READY" : rd(r.storageState);
  const providerState = ps(r.providerState);
  const localBackupReady = legacyHost ? false : bool(r.localBackupReady);
  return {
    legacyHost,
    recoveryRequired,
    jobRecoveryRequired: bool(r.jobRecoveryRequired),
    restoreRecoveryRequired: bool(r.restoreRecoveryRequired),
    recoveryJob: j && {
      jobId: String(j.jobId ?? ""), kind: String(j.kind ?? ""), stage: String(j.stage ?? ""),
      stageIndex: num(j.stageIndex), errorCode: str(j.errorCode), errorMessage: str(j.errorMessage),
      updatedAt: str(j.updatedAt),
    },
    sourceState, sourceBytes: num(r.sourceBytes), entryCount: num(r.entryCount),
    includes: Array.isArray(r.includes) ? r.includes.map(String) : [], sourceErrorCode: str(r.sourceErrorCode),
    storageState, backupRootWritable: bool(r.backupRootWritable),
    usableBytes: num(r.usableBytes), requiredBytes: num(r.requiredBytes), storageErrorCode: str(r.storageErrorCode),
    providerState, provider: str(r.provider), remote: str(r.remote),
    providerErrorCode: str(r.providerErrorCode), providerMessage: str(r.providerMessage),
    localBackupReady,
    offsiteBackupReady: legacyHost ? bool(r.ok) : bool(r.offsiteBackupReady),
  };
}

// ─── Create-button gate: strict priority, never masks the real cause ───────
export type Resolution =
  | "RESOLVE_RECOVERY" | "RERUN_PREFLIGHT" | "TEST_PROVIDER" | "SWITCH_TO_LOCAL" | null;

export interface CreateGate {
  blocked: boolean;
  code: string | null;       // the real Host error code
  title: string;             // short, for ribbon cell + tooltip
  resolution: Resolution;
}

export function deriveCreateGate(i: {
  jobBusy: boolean;
  preflight: PreflightView | null;
  mode: DestinationMode;
  allowLocalFallback: boolean;
}): CreateGate {
  const ok: CreateGate = { blocked: false, code: null, title: "", resolution: null };
  if (i.jobBusy) return { blocked: true, code: "JOB_RUNNING", title: "A maintenance job is running.", resolution: null };
  const p = i.preflight;
  if (!p) return { blocked: true, code: "PREFLIGHT_PENDING", title: "Preflight has not completed.", resolution: "RERUN_PREFLIGHT" };
  if (p.recoveryRequired)
    return { blocked: true, code: "RECOVERY_REQUIRED", title: "Recovery gate is active. Clear it before backing up.", resolution: "RESOLVE_RECOVERY" };
  if (p.sourceState !== "READY")
    return { blocked: true, code: p.sourceErrorCode ?? "SOURCE_UNREADABLE", title: "World source cannot be scanned.", resolution: "RERUN_PREFLIGHT" };
  if (p.storageState !== "READY")
    return { blocked: true, code: p.storageErrorCode ?? "STORAGE_UNAVAILABLE", title: "VPS backup storage is not usable.", resolution: "RERUN_PREFLIGHT" };

  const needsRemote =
    p.legacyHost ||                                   // old Host only knows Drive
    i.mode === "DRIVE_AND_LOCAL" ||
    (i.mode === "AUTO" && !i.allowLocalFallback);
  if (needsRemote && p.providerState !== "CONNECTED") {
    return {
      blocked: true,
      code: p.providerErrorCode ?? "RCLONE_UNAVAILABLE",
      title: p.providerMessage ?? "Off-site provider is not connected.",
      resolution: p.legacyHost ? "TEST_PROVIDER" : p.localBackupReady ? "SWITCH_TO_LOCAL" : "TEST_PROVIDER",
    };
  }
  return ok;
}

// ─── Archive classification for the ledger ─────────────────────────────────
export type ArchiveKind = "DRIVE_AND_LOCAL" | "LOCAL_ONLY" | "DRIVE_ONLY" | "UNVERIFIED";
export function classifyArchive(a: { local?: boolean; offsite?: boolean; verification?: string | null }): ArchiveKind {
  const verified = !!a.verification && a.verification.startsWith("VERIFIED");
  if (!verified) return "UNVERIFIED";
  if (a.local && a.offsite) return "DRIVE_AND_LOCAL";
  if (a.local) return "LOCAL_ONLY";
  return "DRIVE_ONLY";
}

// ─── Stage rail ────────────────────────────────────────────────────────────
export type StageState = "done" | "current" | "pending" | "skipped" | "failed";
export interface StageView { index: number; label: string; state: StageState }

/** `labels` comes from the Host (`stages[]`). FALLBACK is used only for an old Host: generate it
 *  from the Java enum in Phase 0 (14 entries; index 6 is "Stop service"); a unit test pins both facts. */
export const FALLBACK_STAGE_LABELS: string[] = [/* ⟨BIND⟩ 14 labels derived from the Java stage enum */];

export function buildStages(i: {
  labels?: string[]; currentIndex: number; skipped?: number[]; failed?: boolean;
}): StageView[] {
  const labels = i.labels?.length ? i.labels : FALLBACK_STAGE_LABELS;
  const skipped = new Set(i.skipped ?? []);
  return labels.map((label, k) => {
    const index = k + 1;
    const state: StageState =
      skipped.has(index) ? "skipped"
      : index < i.currentIndex ? "done"
      : index === i.currentIndex ? (i.failed ? "failed" : "current")
      : "pending";
    return { index, label, state };
  });
}

// ─── Schedule option sets: always include the current value (never silently coerce it) ──
export const timeOptions = (current?: string): string[] => {
  const base = Array.from({ length: 48 }, (_, n) =>
    `${String(Math.floor(n / 2)).padStart(2, "0")}:${n % 2 ? "30" : "00"}`);
  return current && !base.includes(current) ? [...base, current].sort() : base;
};
export const RETENTION_PRESETS = [3, 5, 7, 10, 14, 30] as const;
export const retentionOptions = (current?: number): number[] =>
  current && !(RETENTION_PRESETS as readonly number[]).includes(current)
    ? [...RETENTION_PRESETS, current].sort((a, b) => a - b) : [...RETENTION_PRESETS];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const COUNTDOWN_OPTIONS = [
  { value: 300, label: "5 minutes" }, { value: 600, label: "10 minutes" },
  { value: 900, label: "15 minutes" }, { value: 1800, label: "30 minutes" },
] as const;

// ─── View-model the view expects. Map the EXISTING presentation selectors into this shape. ──
export interface BackupsVm {
  hostName: string;
  hostOnline: boolean;
  job: {
    id: string | null;
    state: "IDLE" | "ACTIVE" | "RECOVERY_REQUIRED" | "FAILED" | "DONE";
    stageIndex: number;                  // 1-based; 0 when idle
    stageLabels?: string[]; skippedStages?: number[];
    errorCode?: string | null;
    transferMBps?: number | null;
    countdownRemainingSeconds?: number | null;
    destinationMode?: DestinationMode; effectiveDestination?: "DRIVE_AND_LOCAL" | "LOCAL_ONLY";
  };
  schedule: {
    enabled: boolean; cadence: string; weekdays: string[]; time: string; retention: number;
    timezone: string; nextRunText: string | null; nextRestartText: string | null; allowLocalFallback: boolean;
  };
  restorePoints: Array<{
    id: string; createdAt: string; trigger: string; sizeBytes: number; sha256: string | null;
    local: boolean; offsite: boolean; verification: string | null;
  }>;
}
```

`backups-model.test.ts` (or the repo's runner) MUST cover: priority order of `deriveCreateGate` (job > recovery > source > storage > provider; **recovery + provider-down reports `RECOVERY_REQUIRED`**), `needsRemote` matrix, legacy-Host fallbacks, `normalizePreflight` on `null`, `{}` and a full payload, `buildStages` (skipped, failed, 14 length, stage 6 label equals "Stop service"), `timeOptions("04:07")` retains `04:07`, `retentionOptions(10)` has no duplicate.

### 2.2 Host-call and polling hook (inside `Backups.tsx` or `backups-model.ts`)

```ts
import { useCallback, useEffect, useState } from "react";

export function usePreflight(invoke: (action: string, params?: Record<string, unknown>) => Promise<unknown>) {
  const [view, setView] = useState<PreflightView | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fresh = false) => {
    setBusy(true);
    try { setView(normalizePreflight(await invoke("backup.preflight", { fresh }))); }
    catch { /* leave previous view; the ribbon shows the stale-state hint */ }
    finally { setBusy(false); }
  }, [invoke]);
  useEffect(() => { void run(false); }, [run]);                          // on mount
  useEffect(() => {                                                      // light poll while the page is visible
    const t = setInterval(() => { if (!document.hidden) void run(false); }, 30_000);
    return () => clearInterval(t);
  }, [run]);
  return { preflight: view, preflightBusy: busy, rerun: () => run(true) };
}
```

`invoke` is the existing host-call function that `Backups.tsx` already uses today for `backup.create`, `backup.full.retry-upload` and friends (`⟨BIND⟩`). Mirror how those calls pass params. If Phase 0 (§0.4) shows the locked adapter rejects the new params (`fresh`, `destinationMode`, `acknowledgeRestore`), stop and escalate as described there.

### 2.3 View blueprint: `src/ui/routes/Backups.tsx`

Layout (matches the target mock):

1. `.pp-pane.pp-durability` — 44px head: title `Cold backup pipeline · 14 stages`, state dot, `Re-run preflight`, `Test Drive` (`provider.test`).
2. `.pp-gate-band` — rendered **only** when `preflight.recoveryRequired`: flush amber hairline band with the verified-running text and the **`Verify Running & Clear Recovery Gate`** button (`maintenance.recovery.resolve`).
3. Stage rail (`data-testid="backup-rail"`) + caption row (stage label · MB/s · countdown remaining).
4. `.pp-ribbon` — 4 flush cells (`data-testid="preflight-ribbon"`, each `data-gate="recovery|source|storage|provider"`).
5. `.pp-deck.pp-deck--exec` — 2 cells: manual cold restore point, periodic schedule.
6. `.pp-pane` — restore points ledger with filter segment `All | Drive | Local`.

```tsx
"use client";
import { useCallback, useMemo, useState } from "react";
import { PpSelect } from "@/ui/components/PpSelect";            // ⟨BIND⟩ real path
import { Dialog } from "@/ui/components/Dialog";                // ⟨BIND⟩
import { Seg } from "@/ui/components/Seg";                      // ⟨BIND⟩ the existing segmented control (Focus/Split, 1m/5m…)
import { useBackupsVm, useHostInvoke, useConfirmRestore } from "@/ui/bindings/backups-bindings"; // ⟨BIND⟩ thin re-exports of what the page imports today
import { useMaintenanceCountdown } from "@/ui/bindings/maintenance";
import { formatBytes } from "@/lib/format";                      // ⟨BIND⟩ existing helper (locked: import only)
import {
  usePreflight, deriveCreateGate, classifyArchive, buildStages, timeOptions, retentionOptions,
  COUNTDOWN_OPTIONS, WEEKDAYS, type BackupsVm, type DestinationMode, type PreflightView,
} from "@/ui/bindings/backups-model";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const tone = (ok: boolean | null) => (ok === null ? "idle" : ok ? "ok" : "bad");

export default function Backups() {
  const vm: BackupsVm = useBackupsVm();
  const invoke = useHostInvoke();
  const { preflight, preflightBusy, rerun } = usePreflight(invoke);
  const { remainingSeconds } = useMaintenanceCountdown();
  const confirmRestore = useConfirmRestore();   // ⟨BIND⟩ returns (backupId) => void; wraps the EXISTING restore confirmation flow

  const [mode, setMode] = useState<DestinationMode>("AUTO");
  const [warning, setWarning] = useState<number>(300);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "DRIVE" | "LOCAL">("ALL");
  const [resolving, setResolving] = useState(false);

  const jobBusy = vm.job.state === "ACTIVE";
  const gate = useMemo(() => deriveCreateGate({
    jobBusy, preflight, mode, allowLocalFallback: vm.schedule.allowLocalFallback,
  }), [jobBusy, preflight, mode, vm.schedule.allowLocalFallback]);

  const stages = buildStages({
    labels: vm.job.stageLabels, currentIndex: vm.job.stageIndex,
    skipped: vm.job.skippedStages, failed: vm.job.state === "FAILED",
  });

  const resolveRecovery = useCallback(async () => {
    setResolving(true);
    try {
      await invoke("maintenance.recovery.resolve",
        preflight?.restoreRecoveryRequired ? { acknowledgeRestore: true } : {});   // restore case: ONLY after the extra confirm below
      await rerun();
    } finally { setResolving(false); }
  }, [invoke, preflight, rerun]);

  const create = () => invoke("backup.create", { countdownSeconds: warning, destinationMode: mode });

  const rows = vm.restorePoints.filter(r =>
    filter === "ALL" ? true : filter === "DRIVE" ? r.offsite : r.local && !r.offsite);

  return (
    <div className="pp-page" data-route="backups">
      {/* ── 1 · Pipeline pane ─────────────────────────────────────────── */}
      <section className="pp-pane pp-durability" aria-labelledby="pp-dur-title">
        <header className="pp-durability__head">
          <h2 id="pp-dur-title" className="pp-pane__title">Cold backup pipeline · {stages.length} stages</h2>
          <span className="pp-state" data-tone={
            vm.job.state === "RECOVERY_REQUIRED" || preflight?.recoveryRequired ? "warn"
            : vm.job.state === "ACTIVE" ? "ok" : vm.job.state === "FAILED" ? "bad" : "idle"}>
            {preflight?.recoveryRequired ? "Recovery required" : vm.job.state === "ACTIVE" ? "Active" : "Idle"}
          </span>
          <span className="pp-durability__spacer" />
          <button type="button" className="pp-btn pp-btn--ghost" disabled={preflightBusy} onClick={() => rerun()}>
            ↻ Re-run preflight
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" disabled={preflightBusy}
                  onClick={async () => { await invoke("provider.test"); await rerun(); }}>
            Test Drive
          </button>
        </header>

        {preflight?.recoveryRequired && (
          <div className="pp-gate-band" role="alert" data-testid="recovery-band">
            <div className="pp-gate-band__text">
              <strong>RECOVERY GATE ACTIVE</strong>
              {preflight.recoveryJob && (
                <> · Job {preflight.recoveryJob.jobId.slice(0, 8)} interrupted at Stage {preflight.recoveryJob.stageIndex} / {stages.length} ({preflight.recoveryJob.stage}
                {preflight.recoveryJob.errorCode ? ` · code: ${preflight.recoveryJob.errorCode}` : ""})</>
              )}
              <span className="pp-gate-band__sub">
                {vm.hostName} is currently {vm.hostOnline ? "online" : "offline"}.
                {preflight.restoreRecoveryRequired && " A restore was interrupted: review the world before clearing."}
              </span>
            </div>
            <button type="button" className="pp-btn pp-btn--accent" disabled={resolving || !vm.hostOnline}
                    onClick={resolveRecovery}>
              ✓ Verify Running &amp; Clear Recovery Gate
            </button>
          </div>
        )}

        <ol className="pp-rail" data-testid="backup-rail" aria-label="Backup stages">
          {stages.map(s => (
            <li key={s.index} className="pp-rail__node" data-state={s.state}
                aria-current={s.state === "current" ? "step" : undefined} title={s.label}>
              <span className="pp-rail__dot">{s.state === "done" ? "✓" : s.index}</span>
            </li>
          ))}
        </ol>
        <div className="pp-rail__caption">
          <span>{vm.job.stageIndex ? `Stage ${vm.job.stageIndex} / ${stages.length} · ${stages[vm.job.stageIndex - 1]?.label ?? ""}` : "No job running"}</span>
          {vm.job.transferMBps != null && <span>{vm.job.transferMBps.toFixed(1)} MB/s</span>}
          {(remainingSeconds ?? 0) > 0 && <span>{mmss(remainingSeconds!)} remaining</span>}
          {vm.job.id && <span className="pp-mono">{vm.job.id}</span>}
        </div>

        <PreflightRibbon p={preflight} gateCode={gate.code} />
      </section>

      {/* ── 2 · Execution + schedule deck ─────────────────────────────── */}
      <section className="pp-deck pp-deck--exec" aria-label="Backup execution and schedule">
        <div className="pp-deck__cell">
          <div className="pp-eyebrow">Manual cold restore point</div>
          <div className="pp-deck__controls">
            <label className="pp-field">
              <span>Warning countdown</span>
              <PpSelect value={String(warning)} onChange={v => setWarning(Number(v))}
                        options={COUNTDOWN_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} />
            </label>
            <div className="pp-field" role="radiogroup" aria-label="Destination">
              <span>Destination</span>
              <Seg value={mode} onChange={v => setMode(v as DestinationMode)}
                   options={[
                     { value: "AUTO", label: "Auto" },
                     { value: "DRIVE_AND_LOCAL", label: "Drive + Local" },
                     { value: "LOCAL_ONLY", label: "Local VPS only", disabled: !!preflight?.legacyHost },
                   ]} />
            </div>
          </div>
          <div className="pp-deck__actions">
            <button type="button" className="pp-btn pp-btn--accent" disabled={gate.blocked}
                    aria-describedby="pp-gate-desc" onClick={create}>
              ⛁ Create full backup
            </button>
            {gate.blocked && gate.resolution === "SWITCH_TO_LOCAL" && (
              <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setMode("LOCAL_ONLY")}>Use Local VPS only</button>
            )}
            {gate.blocked && gate.resolution === "TEST_PROVIDER" && (
              <button type="button" className="pp-btn pp-btn--ghost" onClick={async () => { await invoke("provider.test"); await rerun(); }}>Re-test provider</button>
            )}
            {gate.blocked && gate.resolution === "RERUN_PREFLIGHT" && (
              <button type="button" className="pp-btn pp-btn--ghost" onClick={() => rerun()}>Re-run preflight</button>
            )}
            <span id="pp-gate-desc" className="pp-sr-only">{gate.blocked ? `${gate.code}: ${gate.title}` : "Ready"}</span>
          </div>
        </div>

        <div className="pp-deck__cell">
          <div className="pp-eyebrow">Periodic schedule · {vm.schedule.timezone}</div>
          <div className="pp-deck__controls">
            <span className="pp-state" data-tone={vm.schedule.enabled ? "ok" : "idle"}>{vm.schedule.enabled ? "Enabled" : "Disabled"}</span>
            <span className="pp-mono">{vm.schedule.cadence} at {vm.schedule.time} · Keep {vm.schedule.retention}</span>
            <span className="pp-muted">{vm.schedule.nextRunText ? `Next run: ${vm.schedule.nextRunText}` : "Next run not reported"}
              {vm.schedule.nextRestartText ? ` · Next restart: ${vm.schedule.nextRestartText}` : ""}</span>
          </div>
          <div className="pp-deck__actions">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setScheduleOpen(true)}>⚙ Configure schedule</button>
          </div>
        </div>
      </section>

      {/* ── 3 · Restore points ledger ─────────────────────────────────── */}
      <section className="pp-pane" aria-labelledby="pp-rp-title">
        <header className="pp-durability__head">
          <h2 id="pp-rp-title" className="pp-pane__title">Restore points · {vm.restorePoints.length} archives</h2>
          <span className="pp-durability__spacer" />
          <Seg value={filter} onChange={v => setFilter(v as typeof filter)}
               options={[{ value: "ALL", label: "All" }, { value: "DRIVE", label: "Drive" }, { value: "LOCAL", label: "Local" }]} />
        </header>
        <table className="pp-table" data-testid="restore-ledger">
          <thead><tr>
            <th>Created</th><th>Trigger</th><th>Size</th><th>Location &amp; integrity</th><th>SHA-256</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="pp-table__empty">No restore points returned</td></tr>}
            {rows.map(r => {
              const kind = classifyArchive(r);
              return (
                <tr key={r.id}>
                  <td className="pp-mono">{r.createdAt}</td>
                  <td>{r.trigger}</td>
                  <td className="pp-mono">{formatBytes(r.sizeBytes)}</td>
                  <td><span className="pp-state" data-tone={kind === "UNVERIFIED" ? "warn" : "ok"}>
                    {kind === "DRIVE_AND_LOCAL" ? "Drive + Local (Verified)" : kind === "LOCAL_ONLY" ? "Local VPS (Verified)"
                      : kind === "DRIVE_ONLY" ? "Drive (Verified)" : "Unverified"}</span></td>
                  <td className="pp-mono">
                    {r.sha256 ? `${r.sha256.slice(0, 4)}…${r.sha256.slice(-4)}` : "—"}
                    {r.sha256 && <button type="button" className="pp-icon-btn" aria-label="Copy SHA-256"
                      onClick={() => navigator.clipboard?.writeText(r.sha256!)}>⧉</button>}
                  </td>
                  <td className="pp-table__actions">
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => invoke("backup.full.verify", { backupId: r.id })}>Verify</button>
                    {kind === "LOCAL_ONLY" && (
                      <button type="button" className="pp-btn pp-btn--ghost"
                        disabled={preflight?.providerState !== "CONNECTED"}
                        onClick={() => invoke("backup.full.retry-upload", { backupId: r.id })}>↑ Promote to Drive</button>
                    )}
                    <button type="button" className="pp-btn pp-btn--danger" onClick={() => confirmRestore(r.id)}>Restore</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {scheduleOpen && <ScheduleDialog vm={vm} onClose={() => setScheduleOpen(false)} />}
    </div>
  );
}
```

Binding notes for the block above:
- Use the **real action names** the page already calls for verify / restore / schedule save. Where this spec writes `backup.full.verify`, `useConfirmRestore` or a schedule action, replace with the existing ones from Phase 0. `useConfirmRestore` stands for the existing restore confirmation flow: keep it exactly as it behaves today (rename the call site, not the behavior; do not call a hook inside an event handler, use whatever the current page does).
- The `Restore` button keeps its existing destructive confirmation (`confirmRestore` wraps today's flow; never call a hook inside an event handler). `Promote to Drive` is shown only for `LOCAL_ONLY` archives and never requires stopping Minecraft.
- When `preflight.restoreRecoveryRequired`, clicking `Verify Running & Clear Recovery Gate` MUST first open a confirmation `Dialog` ("A restore was interrupted. Confirm you reviewed the world.") before sending `acknowledgeRestore: true`. Only the *job* recovery case is one click.
- **Tooltip overlap fix:** do not use a hover tooltip on the disabled button to carry the reason (that is what overlapped `Restore points`). The reason is shown in the ribbon's provider/gate cell and via `aria-describedby` (`#pp-gate-desc`). If a visual tooltip is kept, it MUST render through the app's portal layer with `placement="top"`, collision-aware, `pointer-events: none`, above all pane headers.
- The 3 ribbon/deck regions never render `<p class="gate-reason">`.

#### `PreflightRibbon`

```tsx
function PreflightRibbon({ p, gateCode }: { p: PreflightView | null; gateCode: string | null }) {
  if (!p) return <div className="pp-ribbon" data-testid="preflight-ribbon" aria-busy="true">
    {["recovery", "source", "storage", "provider"].map(g => (
      <div className="pp-ribbon__cell" data-gate={g} key={g}><span className="pp-eyebrow">{g}</span><span className="pp-muted">Checking…</span></div>))}
  </div>;

  const giB = (n: number) => `${(n / 1024 ** 3).toFixed(2)} GiB`;
  const providerLabel =
    p.legacyHost ? "Host update required for local backups"
    : p.providerState === "CONNECTED" ? "Connected"
    : p.providerState === "NOT_CONFIGURED" ? (p.localBackupReady ? "Local only" : "Not configured") : "Unreachable";

  return (
    <div className="pp-ribbon" data-testid="preflight-ribbon">
      <div className="pp-ribbon__cell" data-gate="recovery" data-code={gateCode === "RECOVERY_REQUIRED" ? gateCode : undefined}>
        <span className="pp-eyebrow">01 · Recovery &amp; lock</span>
        <span className="pp-state" data-tone={p.recoveryRequired ? "warn" : "ok"}>{p.recoveryRequired ? "Recovery required" : "Clear"}</span>
        <span className="pp-muted">{p.recoveryRequired ? "Resolve to unlock backups" : "Host ready · 0 locks"}</span>
      </div>
      <div className="pp-ribbon__cell" data-gate="source" data-code={p.sourceErrorCode ?? undefined}>
        <span className="pp-eyebrow">02 · World source scan</span>
        <span className="pp-state" data-tone={tone(p.sourceState === "READY")}>{p.sourceState === "READY" ? `Ready · ${giB(p.sourceBytes)}` : p.sourceErrorCode ?? "Failed"}</span>
        <span className="pp-muted">{p.entryCount.toLocaleString()} files · {p.includes.length || 1} roots</span>
      </div>
      <div className="pp-ribbon__cell" data-gate="storage" data-code={p.storageErrorCode ?? undefined}>
        <span className="pp-eyebrow">03 · VPS disk headroom</span>
        <span className="pp-state" data-tone={tone(p.storageState === "READY")}>{p.storageState === "READY" ? `Ready · ${giB(p.usableBytes)} free` : p.storageErrorCode ?? "Failed"}</span>
        <span className="pp-muted">{giB(p.requiredBytes)} required (2×)</span>
      </div>
      <div className="pp-ribbon__cell" data-gate="provider" data-code={p.providerErrorCode ?? undefined}>
        <span className="pp-eyebrow">04 · Off-site rclone</span>
        <span className="pp-state" data-tone={p.providerState === "CONNECTED" ? "ok" : p.localBackupReady ? "warn" : "bad"}>{providerLabel}</span>
        <span className="pp-muted pp-ellipsis" title={p.providerMessage ?? p.remote ?? ""}>
          {p.providerState === "CONNECTED" ? p.remote : p.providerErrorCode ?? "—"}</span>
      </div>
    </div>
  );
}
```

### 2.4 Custom Obsidian schedule dialog (zero native form inputs)

Replace every native `<input type="checkbox|number|time">` in the `Edit schedule` modal. Title becomes **Configure schedule**.

```tsx
function ScheduleDialog({ vm, onClose }: { vm: BackupsVm; onClose: () => void }) {
  const invoke = useHostInvoke();
  const s = vm.schedule;
  const [enabled, setEnabled] = useState(s.enabled);
  const [cadence, setCadence] = useState(s.cadence);                  // values from the existing schedule contract ⟨BIND⟩
  const [days, setDays] = useState<string[]>(s.weekdays);
  const [time, setTime] = useState(s.time);
  const [keep, setKeep] = useState(s.retention);
  const [fallback, setFallback] = useState(s.allowLocalFallback);
  const [saving, setSaving] = useState(false);
  const weekly = /week/i.test(cadence);

  const save = async () => {
    setSaving(true);
    try {
      await invoke("maintenance.schedule.update" /* ⟨BIND⟩ existing action */, {
        enabled, cadence, weekdays: days, time, retention: keep, allowLocalFallback: fallback,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open title="Configure schedule" onClose={onClose}>
      <div className="pp-form">
        <div className="pp-field"><span>Status</span>
          <Seg value={enabled ? "ON" : "OFF"} onChange={v => setEnabled(v === "ON")}
               options={[{ value: "ON", label: "Enabled" }, { value: "OFF", label: "Disabled" }]} /></div>

        <label className="pp-field"><span>Cadence</span>
          <PpSelect value={cadence} onChange={setCadence} options={/* ⟨BIND⟩ existing cadence options */ []} /></label>

        {weekly && (
          <div className="pp-field"><span>Days</span>
            <div className="pp-wk" role="group" aria-label="Weekdays">
              {WEEKDAYS.map(d => (
                <button key={d} type="button" className="pp-wk__pill" aria-pressed={days.includes(d)}
                        onClick={() => setDays(x => x.includes(d) ? x.filter(y => y !== d) : [...x, d])}>{d}</button>))}
            </div></div>)}

        <label className="pp-field"><span>Time · {s.timezone}</span>
          <PpSelect value={time} onChange={setTime} options={timeOptions(s.time).map(t => ({ value: t, label: t }))} /></label>

        <label className="pp-field"><span>Keep</span>
          <PpSelect value={String(keep)} onChange={v => setKeep(Number(v))}
                    options={retentionOptions(s.retention).map(n => ({ value: String(n), label: `${n} restore points` }))} /></label>

        <div className="pp-field"><span>If Drive is unreachable</span>
          <Seg value={fallback ? "LOCAL" : "FAIL"} onChange={v => setFallback(v === "LOCAL")}
               options={[{ value: "FAIL", label: "Fail the run" }, { value: "LOCAL", label: "Keep a local backup" }]} /></div>
      </div>
      <footer className="pp-dialog__foot">
        <button type="button" className="pp-btn pp-btn--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="pp-btn pp-btn--accent" disabled={saving || (weekly && days.length === 0)} onClick={save}>Save schedule</button>
      </footer>
    </Dialog>
  );
}
```

`allowLocalFallback` MUST be sent in whatever settings payload the existing schedule/settings action accepts. If that action validates a fixed schema on the Host, extend the Host's `MaintenanceSettings.FullRestorePoint` parsing (§1.2) in the same release.

### 2.5 CSS — append to `src/ui/styles/globals.css`

Map the `var(--…)` fallbacks to the real token names found in `:root` (`grep -n ":root" src/ui/styles/globals.css`). Do not add new colors that the system lacks; the fallbacks exist only so the file is valid standalone.

```css
/* ═════ v6.0 · Obsidian Durability Workbench ═════════════════════════════ */
.pp-durability { display: flex; flex-direction: column; min-width: 0; }
.pp-durability__head {
  height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 16px;
  border-bottom: 1px solid var(--pp-hairline, rgb(255 255 255 / .08));
}
.pp-durability__spacer { flex: 1 1 auto; }

/* status dot — NOT a badge; never counted by the badge-budget checks */
.pp-state {
  display: inline-flex; align-items: center; gap: 6px; min-width: 0;
  font: 600 11px/1.2 var(--pp-font-mono, ui-monospace, monospace);
  letter-spacing: .06em; text-transform: uppercase; color: var(--pp-muted, #8b95a1);
}
.pp-state::before { content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pp-state[data-tone="ok"]   { color: var(--pp-ok, #34d399); }
.pp-state[data-tone="warn"] { color: var(--pp-warn, #f5b74a); }
.pp-state[data-tone="bad"]  { color: var(--pp-bad, #f87171); }

/* recovery band — flush, square, hairlines; 2px left accent only */
.pp-gate-band {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 16px; border: 0; border-radius: 0;
  border-bottom: 1px solid var(--pp-hairline, rgb(255 255 255 / .08));
  border-left: 2px solid var(--pp-warn, #f5b74a);
  background: color-mix(in srgb, var(--pp-warn, #f5b74a) 7%, transparent);
}
.pp-gate-band__text { display: grid; gap: 2px; min-width: 0; font-size: 12px; }
.pp-gate-band__sub { color: var(--pp-muted, #8b95a1); }

/* 14-stage rail: reuse the existing node markup/classes if the invariants flag these nodes */
.pp-rail { list-style: none; margin: 0; padding: 18px 16px 8px; display: flex; align-items: center; }
.pp-rail__node { flex: 1 1 0; position: relative; display: flex; justify-content: center; }
.pp-rail__node + .pp-rail__node::before {
  content: ""; position: absolute; left: -50%; right: 50%; top: 50%; height: 1px;
  background: var(--pp-hairline, rgb(255 255 255 / .12));
}
.pp-rail__node[data-state="done"]::before, .pp-rail__node[data-state="current"]::before { background: var(--pp-accent, #22d3ee); }
.pp-rail__dot {
  position: relative; z-index: 1; width: 22px; height: 22px; display: grid; place-items: center;
  border-radius: 50%; border: 1px solid var(--pp-hairline, rgb(255 255 255 / .16));
  background: var(--pp-surface, #0b0f14); font: 600 10px/1 var(--pp-font-mono, monospace); color: var(--pp-muted, #8b95a1);
}
.pp-rail__node[data-state="done"] .pp-rail__dot    { color: var(--pp-ok, #34d399); border-color: currentColor; }
.pp-rail__node[data-state="current"] .pp-rail__dot { color: var(--pp-accent, #22d3ee); border-color: currentColor; }
.pp-rail__node[data-state="failed"] .pp-rail__dot  { color: var(--pp-bad, #f87171); border-color: currentColor; }
.pp-rail__node[data-state="skipped"] .pp-rail__dot { opacity: .45; border-style: dashed; }
.pp-rail__caption { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 4px 16px 14px; font-size: 12px; color: var(--pp-muted, #8b95a1); }

/* 4-cell preflight ribbon — hairline-separated, zero radius */
.pp-ribbon { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--pp-hairline, rgb(255 255 255 / .08)); }
.pp-ribbon__cell {
  display: grid; align-content: start; gap: 4px; min-width: 0; padding: 12px 16px;
  border: 0; border-radius: 0; border-right: 1px solid var(--pp-hairline, rgb(255 255 255 / .08));
}
.pp-ribbon__cell:last-child { border-right: 0; }
.pp-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 1100px) {
  .pp-ribbon { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pp-ribbon__cell:nth-child(2) { border-right: 0; }
  .pp-ribbon__cell:nth-child(n+3) { border-top: 1px solid var(--pp-hairline, rgb(255 255 255 / .08)); }
}
@media (max-width: 640px) {
  .pp-ribbon { grid-template-columns: minmax(0, 1fr); }
  .pp-ribbon__cell { border-right: 0; }
  .pp-ribbon__cell + .pp-ribbon__cell { border-top: 1px solid var(--pp-hairline, rgb(255 255 255 / .08)); }
}

/* 2-cell execution deck — action row pinned to the bottom, can never overlap the footer */
.pp-deck--exec { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pp-deck--exec .pp-deck__cell {
  display: grid; grid-template-rows: auto 1fr auto; row-gap: 12px; min-height: 176px; min-width: 0;
  padding: 16px; border: 0; border-radius: 0;
}
.pp-deck--exec .pp-deck__cell + .pp-deck__cell { border-left: 1px solid var(--pp-hairline, rgb(255 255 255 / .08)); }
.pp-deck__controls { display: flex; flex-wrap: wrap; align-items: end; gap: 12px 16px; }
.pp-deck__actions { align-self: end; display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 860px) {
  .pp-deck--exec { grid-template-columns: minmax(0, 1fr); }
  .pp-deck--exec .pp-deck__cell + .pp-deck__cell { border-left: 0; border-top: 1px solid var(--pp-hairline, rgb(255 255 255 / .08)); }
}

/* ledger */
.pp-table__actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }

/* weekday pills (inside the Dialog) */
.pp-wk { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.pp-wk__pill {
  height: 30px; border: 1px solid var(--pp-hairline, rgb(255 255 255 / .12)); border-radius: 6px; background: transparent;
  color: var(--pp-muted, #8b95a1); font: 600 11px/1 var(--pp-font-mono, monospace); cursor: pointer;
}
.pp-wk__pill[aria-pressed="true"] { color: var(--pp-accent, #22d3ee); border-color: currentColor; background: color-mix(in srgb, currentColor 10%, transparent); }
.pp-wk__pill:focus-visible { outline: 2px solid var(--pp-accent, #22d3ee); outline-offset: 2px; }

.pp-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

---

## §3. Cross-Dashboard v6.0 Polish Blueprints

### 3.1 `/performance` — `.pp-readout-bar` right-edge clipping

**Cause (from the screenshots):** `.pp-readout-bar` is `overflow: hidden; white-space: nowrap` with verbose labels (`Loaded chunks`, `Entities`), so at 1366 to 1545 px the last group (`WORLD Loaded chunks 441 Entit…`) is cut off.

**Fix — files:** `src/ui/routes/Performance.tsx` (or the `PerformanceWorkbench` file that renders the bar) and `globals.css`. Change nothing else in the workbench.

1. Compact labels. Keep the full text in `title`/`aria-label`:

```tsx
// next to the ReadoutBar definition
const READOUT_LABEL: Record<string, { short: string; full: string }> = {
  loadedChunks: { short: "Chunks",   full: "Loaded chunks" },
  entities:     { short: "Entities", full: "Entities" },
  // Keep every other label exactly as today unless it is the one clipping.
};
// render: <span className="pp-readout__k" title={full} aria-label={full}>{short}</span>
```

2. CSS — replace the existing `.pp-readout-bar` overflow rules (do not touch its typography or colors):

```css
.pp-readout-bar {
  display: flex; flex-wrap: wrap; align-items: baseline;
  column-gap: 14px; row-gap: 4px;
  min-width: 0; max-width: 100%;
  overflow: visible;           /* was: hidden */
  white-space: normal;         /* was: nowrap */
}
.pp-readout-bar > * { min-width: 0; white-space: nowrap; }      /* each group stays intact; wrapping happens BETWEEN groups */
.pp-readout-bar__group { display: inline-flex; gap: 6px; flex: 0 0 auto; }
```

3. Layout safety: the bar's parent grid row MUST be `auto` (not a fixed height) so a wrapped second line pushes the charts down instead of overlapping them. Verify at 1280, 1366, 1545 and 1920 px that the analyzer still fits the viewport without introducing page scroll that did not exist at `bd6efa6` (compare against the baseline screenshots).
4. Result at all four widths: `WORLD Chunks 441 · Entities 288` is fully visible.

### 3.2 `MissionControlHeader` — countdown pill and synced `Quick Backup`

**New file `src/ui/bindings/maintenance.ts`:**

```ts
import { useCallback, useEffect, useRef, useState } from "react";

export type CountdownKind = "BACKUP" | "RESTART" | "STOP";
export interface MaintenanceView {
  recoveryRequired: boolean;
  countdownState: "IDLE" | "ACTIVE";
  countdownKind: CountdownKind | null;
  remainingAtSnapshot: number | null;       // seconds
  snapshotAt: number;                       // performance.now() when the snapshot arrived (monotonic, skew-free)
}

export function normalizeMaintenance(raw: unknown, nowPerf = performance.now()): MaintenanceView {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const active = r.countdownState === "ACTIVE";
  let remaining: number | null = typeof r.countdownRemainingSeconds === "number" ? r.countdownRemainingSeconds : null;
  if (remaining == null && active && typeof r.countdownEndsAt === "string") {
    const ms = Date.parse(r.countdownEndsAt) - Date.now();
    remaining = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null;      // fallback only
  }
  const kind = ["BACKUP", "RESTART", "STOP"].includes(r.countdownKind) ? r.countdownKind : null;
  return {
    recoveryRequired: r.recoveryRequired === true,
    countdownState: active ? "ACTIVE" : "IDLE",
    countdownKind: active ? kind : null,
    remainingAtSnapshot: active ? remaining : null,
    snapshotAt: nowPerf,
  };
}

export const formatMmSs = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** Subscribes to the existing maintenance.status event stream if the adapter exposes one (⟨BIND⟩),
 *  otherwise polls `maintenance.status` every 5 s while the tab is visible. Ticks at 1 Hz locally. */
export function useMaintenanceCountdown(invoke?: (a: string) => Promise<unknown>) {
  const [snap, setSnap] = useState<MaintenanceView>(() => normalizeMaintenance(null));
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  const pull = useCallback(async () => {
    if (!invoke) return;
    try { if (alive.current) setSnap(normalizeMaintenance(await invoke("maintenance.status"))); } catch { /* keep last */ }
  }, [invoke]);

  useEffect(() => {
    alive.current = true;
    void pull();
    const poll = setInterval(() => { if (!document.hidden) void pull(); }, 5000);
    return () => { alive.current = false; clearInterval(poll); };
  }, [pull]);

  useEffect(() => {
    if (snap.countdownState !== "ACTIVE") return;
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [snap.countdownState]);

  const remainingSeconds =
    snap.countdownState === "ACTIVE" && snap.remainingAtSnapshot != null
      ? Math.max(0, snap.remainingAtSnapshot - Math.floor((performance.now() - snap.snapshotAt) / 1000))
      : null;
  void tick;
  return { ...snap, remainingSeconds, refresh: pull };
}
```

If the existing presentation layer already provides `maintenance.status` (Phase 0), read from it instead of polling; keep `normalizeMaintenance` as the single parsing point and unit-test it.

**Header pill — `MissionControlHeader.tsx` (surgical addition, between the status cluster and `Quick Backup`):**

```tsx
const { countdownState, countdownKind, remainingSeconds, recoveryRequired } = useMaintenanceCountdown(invoke);
const backupGate = useQuickBackupGate();      // see below

{countdownState === "ACTIVE" && remainingSeconds != null && (
  <span className="pp-countdown-pill" role="timer" aria-live="off"
        data-testid="countdown-pill" data-kind={countdownKind ?? undefined}
        aria-label={`${countdownKind === "RESTART" ? "Restart" : "Backup"} in ${formatMmSs(remainingSeconds)}`}>
    <span className="pp-countdown-pill__icon" aria-hidden>⟳</span>
    <span className="pp-countdown-pill__label">{countdownKind === "RESTART" ? "Restart" : countdownKind === "STOP" ? "Stop" : "Backup"} in</span>
    <span className="pp-countdown-pill__time">{formatMmSs(remainingSeconds)}</span>
  </span>
)}
```

```css
.pp-countdown-pill {
  display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; flex: none;
  border: 1px solid color-mix(in srgb, var(--pp-warn, #f5b74a) 45%, transparent); border-radius: 999px;
  color: var(--pp-warn, #f5b74a); background: color-mix(in srgb, var(--pp-warn, #f5b74a) 8%, transparent);
  font: 600 11px/1 var(--pp-font-mono, ui-monospace, monospace); letter-spacing: .04em;
  animation: pp-pulse 1.6s ease-in-out infinite;
}
.pp-countdown-pill__time { font-variant-numeric: tabular-nums; }
@keyframes pp-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .62 } }
@media (prefers-reduced-motion: reduce) { .pp-countdown-pill { animation: none; } }
@media (max-width: 1100px) { .pp-countdown-pill__label { display: none; } }   /* icon + time only; header stays one line */
```

Rules: the pill is inside the existing 56 px header and MUST NOT change its height or push `Quick Backup` to a second line at 1024 px, 1280 px or 1545 px. It is not a `Live`/`PAPER` badge; it carries no badge class.

**`Quick Backup` sync:**

```ts
export function useQuickBackupGate() {
  const invoke = useHostInvoke();                                 // ⟨BIND⟩
  const { recoveryRequired } = useMaintenanceCountdown(invoke);
  const { preflight } = usePreflight(invoke);                     // same 30 s cached poll as /backups; provider test is TTL-cached on the Host
  const gate = deriveCreateGate({ jobBusy: false, preflight, mode: "AUTO", allowLocalFallback: /* from schedule vm */ false });
  const tooltip =
    recoveryRequired || preflight?.recoveryRequired
      ? "Host recovery gate is active — resolve on Backups page."
      : gate.blocked ? `${gate.code}: ${gate.title}${gate.resolution === "SWITCH_TO_LOCAL" ? " Open Backups to use Local VPS only." : ""}` : "";
  return { blocked: gate.blocked || recoveryRequired, tooltip,
           run: () => invoke("backup.create", { countdownSeconds: 300, destinationMode: "AUTO" }) };
}
```

`Quick Backup` ALWAYS sends `{ countdownSeconds: 300, destinationMode: "AUTO" }`. When blocked it is `aria-disabled` with the tooltip above (tooltip via the app's portal layer, `pointer-events: none`). Clicking a blocked `Quick Backup` navigates to `/backups` instead of failing silently (progressive enhancement; keep the tooltip text exact for the recovery case).

### 3.3 Click-to-inspect player from `/overview`

**`src/ui/bindings/view-sync.ts`** — add one field; everything else (key `"plexon:view-sync"`, cross-tab sync, defaults) stays:

```ts
export interface ViewSyncState {
  /* …existing fields unchanged… */
  selectedPlayerUuid: string;        // "" = none. Either a UUID, or "name:<lowercased name>" when only a name is known.
}
// defaults: selectedPlayerUuid: ""
// reader sanitizer (older persisted JSON lacks the field → default ""):
//   selectedPlayerUuid: typeof v.selectedPlayerUuid === "string" && v.selectedPlayerUuid.length <= 64 ? v.selectedPlayerUuid : ""
```

**New pure helper `src/ui/bindings/player-selection.ts`:**

```ts
export interface PlayerRef { uuid?: string | null; name?: string | null }

export const toSelectionKey = (p: PlayerRef): string =>
  p.uuid ? p.uuid.toLowerCase() : p.name ? `name:${p.name.toLowerCase()}` : "";

export const matchesSelection = (p: PlayerRef, key: string): boolean =>
  !!key && (key.startsWith("name:")
    ? !!p.name && p.name.toLowerCase() === key.slice(5)            // Minecraft names are case-insensitive
    : !!p.uuid && p.uuid.toLowerCase() === key);
```

**Shared navigation hook (`src/ui/bindings/player-selection.ts` or a sibling `usePlayerInspect.ts`):**

```ts
export function usePlayerInspect() {
  const router = useRouter();                                  // next/navigation
  const [, patch] = useViewSync();                              // ⟨BIND⟩ real shape of useViewSync()'s setter
  return useCallback((p: PlayerRef) => {
    const key = toSelectionKey(p);
    if (!key) return;
    patch({ selectedPlayerUuid: key });
    router.push("/players");
  }, [patch, router]);
}
```

**`/overview` — `Active roster` rows and `PlayerEventsDock` rows:** make a row interactive only when it has a resolvable player (uuid or name). Mirror the existing `/players` list row semantics.

```tsx
const inspect = usePlayerInspect();
<li role="button" tabIndex={0} className="pp-roster__row pp-row--interactive"
    aria-label={`Inspect ${p.name}`}
    onClick={() => inspect({ uuid: p.uuid, name: p.name })}
    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inspect({ uuid: p.uuid, name: p.name }); } }}>
  …existing cells unchanged…
</li>
```

Any control inside a row (copy buttons, menus) MUST `stopPropagation()` on click. Hover/focus affordance: background tint and a visible `:focus-visible` outline, no new borders or rounded boxes:

```css
.pp-row--interactive { cursor: pointer; }
.pp-row--interactive:hover { background: color-mix(in srgb, var(--pp-accent, #22d3ee) 6%, transparent); }
.pp-row--interactive:focus-visible { outline: 2px solid var(--pp-accent, #22d3ee); outline-offset: -2px; }
```

**`/players` — consume the selection (and keep it two-way):**

```tsx
const [view, patch] = useViewSync();
useEffect(() => {
  if (!view.selectedPlayerUuid || players.length === 0) return;
  const hit = players.find(p => matchesSelection(p, view.selectedPlayerUuid));
  if (hit && hit.uuid !== selectedUuid) { setSelectedUuid(hit.uuid); scrollRowIntoView(hit.uuid); }   // existing selection state ⟨BIND⟩
  // not found (offline / unknown): do nothing, no error flash
}, [view.selectedPlayerUuid, players]);
// when the user picks a different player in /players, also: patch({ selectedPlayerUuid: toSelectionKey(p) })
```

Unit tests: `toSelectionKey` / `matchesSelection` (uuid case-insensitive; name fallback; empty key never matches), `useViewSync` default and sanitizer for `selectedPlayerUuid`.

---

## §4. End-to-End Verification & QA Gate

### 4.1 Host (`host-agent/`)

```bash
./gradlew test check
```
Required to pass, in addition to the pre-existing suite: `FullBackupPreflightTest`, `DestinationModeTest`, `MaintenanceFullBackupFailurePolicyTest` (as specified in §1.5). Also run `./gradlew test check` in `agent/` if you touched anything there (you should not need to).

### 4.2 Dashboard

```bash
npm run typecheck       # or tsc --noEmit, whichever the repo defines
npm run lint
npm test                # includes backups-model, maintenance, player-selection unit tests
npm run build
npm run verify:structure
node scripts/polish-checks.mjs
# plus the existing core-hash verification (§0.4): zero drift in the 27 locked files
```

### 4.3 Added structural checks (extend `verify:structure` / `scripts/polish-checks.mjs`; never weaken the existing 25)

| New check | Assertion |
|---|---|
| `backupsNoNativeControls` | On `/backups`, with the schedule dialog open: zero `select`, `input[type=checkbox]`, `input[type=number]`, `input[type=time]` |
| `backupsNoHero` | `/backups` has no element containing `Restore with evidence.` and no `R06 / DURABILITY` eyebrow |
| `readoutBarNoClip` | `/performance`: `.pp-readout-bar` has `scrollWidth <= clientWidth`, and every child's `getBoundingClientRect().right <= bar.right + 0.5`, at `1280×800`, `1366×768`, `1545×911`, `1920×1080` |
| `headerHeight56WithCountdown` | `header[role="banner"]` height `== 56` on every route, with and without an active countdown |
| `gateReasonInlineZero` | zero `p.gate-reason` on every route, including `/backups` in recovery state |

### 4.4 Playwright specs

Use the repo's existing fixture/mock-Host mechanism (found in Phase 0). The helpers `loadFixture`, `hostCalls` below are stand-ins: bind to the real ones. If no recorder of Host calls exists, add one **under `src/ui/fixtures/**` (not in locked code)** that appends `{action, params}` to `window.__ppHostCalls`.

```ts
// tests/e2e/v6-durability.spec.ts
import { test, expect } from "@playwright/test";
import { loadFixture, hostCalls } from "./support/fixtures";      // ⟨BIND⟩

const NATIVE = 'select, input[type="checkbox"], input[type="number"], input[type="time"]';

test.describe("/backups — recovery gate", () => {
  test.beforeEach(async ({ page }) => { await loadFixture(page, "backups-recovery-required"); await page.goto("/backups"); });

  test("renders the clear button, the recovery band and the 4-cell ribbon", async ({ page }) => {
    await expect(page.getByTestId("recovery-band")).toBeVisible();
    await expect(page.getByRole("button", { name: /Verify Running & Clear Recovery Gate/ })).toBeVisible();
    await expect(page.getByTestId("preflight-ribbon").locator("[data-gate]")).toHaveCount(4);
    await expect(page.getByTestId("backup-rail").locator("li")).toHaveCount(14);
  });

  test("create is blocked by the REAL cause (recovery), not the provider", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Create full backup/ })).toBeDisabled();
    await expect(page.locator('[data-gate="recovery"]')).toHaveAttribute("data-code", "RECOVERY_REQUIRED");
  });

  test("clicking clear calls maintenance.recovery.resolve and unlocks", async ({ page }) => {
    await page.getByRole("button", { name: /Verify Running & Clear Recovery Gate/ }).click();
    expect((await hostCalls(page)).map(c => c.action)).toContain("maintenance.recovery.resolve");
    await expect(page.getByTestId("recovery-band")).toHaveCount(0);
  });
});

test.describe("/backups — local-first", () => {
  test("provider not configured: local mode is available and sent as LOCAL_ONLY", async ({ page }) => {
    await loadFixture(page, "backups-provider-not-configured");        // localBackupReady=true, providerState=NOT_CONFIGURED
    await page.goto("/backups");
    await expect(page.locator('[data-gate="provider"]')).toContainText(/Local only/i);
    await page.getByRole("radio", { name: /Local VPS only/i }).click();
    const create = page.getByRole("button", { name: /Create full backup/ });
    await expect(create).toBeEnabled();
    await create.click();
    const call = (await hostCalls(page)).find(c => c.action === "backup.create");
    expect(call?.params).toMatchObject({ destinationMode: "LOCAL_ONLY", countdownSeconds: 300 });
  });

  test("create button never overlaps the deck footer or the ledger header", async ({ page }) => {
    await loadFixture(page, "backups-healthy"); await page.goto("/backups");
    const btn = await page.getByRole("button", { name: /Create full backup/ }).boundingBox();
    const cell = await page.locator(".pp-deck--exec .pp-deck__cell").first().boundingBox();
    const ledger = await page.getByTestId("restore-ledger").boundingBox();
    expect(btn!.y + btn!.height).toBeLessThanOrEqual(cell!.y + cell!.height + 0.5);
    expect(btn!.y + btn!.height).toBeLessThanOrEqual(ledger!.y);
  });

  test("zero native controls, including inside the schedule dialog", async ({ page }) => {
    await loadFixture(page, "backups-healthy"); await page.goto("/backups");
    await expect(page.locator(`[data-route="backups"] :is(${NATIVE})`)).toHaveCount(0);
    await page.getByRole("button", { name: /Configure schedule/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").locator(NATIVE)).toHaveCount(0);
    await expect(page.getByText("Restore with evidence.")).toHaveCount(0);
  });

  test("old Host (no localBackupReady) hides Local VPS only", async ({ page }) => {
    await loadFixture(page, "backups-legacy-host"); await page.goto("/backups");
    await expect(page.getByRole("radio", { name: /Local VPS only/i })).toBeDisabled();
  });
});

test.describe("/performance — readout bar", () => {
  for (const [w, h] of [[1280, 800], [1366, 768], [1545, 911], [1920, 1080]] as const) {
    test(`no right-edge clipping at ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await loadFixture(page, "performance-live"); await page.goto("/performance");
      const bar = page.locator(".pp-readout-bar").first();
      await expect(bar).toContainText(/Chunks\s*\d+/);
      await expect(bar).toContainText(/Entities\s*\d+/);
      const r = await bar.evaluate(el => {
        const b = el.getBoundingClientRect();
        return { fits: el.scrollWidth <= el.clientWidth,
                 worst: Math.max(...[...el.children].map(c => c.getBoundingClientRect().right - b.right)) };
      });
      expect(r.fits).toBe(true);
      expect(r.worst).toBeLessThanOrEqual(0.5);
    });
  }
});

test.describe("header", () => {
  test("active countdown shows a pill and keeps the header at 56px", async ({ page }) => {
    await loadFixture(page, "countdown-backup-active");               // countdownState=ACTIVE, kind=BACKUP, remaining=258
    for (const w of [1024, 1280, 1545]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto("/overview");
      await expect(page.getByTestId("countdown-pill")).toContainText(/04:1\d|04:2\d/);
      const h = await page.locator('header[role="banner"]').evaluate(el => el.getBoundingClientRect().height);
      expect(h).toBe(56);
    }
  });

  test("Quick Backup is blocked with the recovery tooltip when recovery is active", async ({ page }) => {
    await loadFixture(page, "backups-recovery-required"); await page.goto("/overview");
    const qb = page.getByRole("button", { name: /Quick Backup/ });
    await expect(qb).toHaveAttribute("aria-disabled", "true");
    await qb.hover();
    await expect(page.getByText("Host recovery gate is active — resolve on Backups page.")).toBeVisible();
  });

  test("Quick Backup sends AUTO / 300s when healthy", async ({ page }) => {
    await loadFixture(page, "backups-healthy"); await page.goto("/overview");
    await page.getByRole("button", { name: /Quick Backup/ }).click();
    expect((await hostCalls(page)).find(c => c.action === "backup.create")?.params)
      .toMatchObject({ countdownSeconds: 300, destinationMode: "AUTO" });
  });
});

test.describe("click-to-inspect", () => {
  test("active roster row opens that player in /players", async ({ page }) => {
    await loadFixture(page, "overview-one-player");                   // NEGUINCOMCEROL online
    await page.goto("/overview");
    await page.getByRole("button", { name: /Inspect NEGUINCOMCEROL/i }).first().click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.getByTestId("player-inspector")).toContainText("NEGUINCOMCEROL");   // ⟨BIND⟩ real inspector test id
  });

  test("player-events dock row (name-only match) also works, case-insensitively", async ({ page }) => {
    await loadFixture(page, "overview-one-player"); await page.goto("/overview");
    await page.getByRole("tab", { name: /Player events/ }).click();
    await page.getByRole("button", { name: /Inspect neguincomcerol/i }).first().click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.getByTestId("player-inspector")).toContainText(/NEGUINCOMCEROL/i);
  });

  test("selection survives reload via plexon:view-sync and unknown players do not error", async ({ page }) => {
    await loadFixture(page, "overview-one-player"); await page.goto("/overview");
    await page.evaluate(() => localStorage.setItem("plexon:view-sync",
      JSON.stringify({ ...(JSON.parse(localStorage.getItem("plexon:view-sync") ?? "{}")), selectedPlayerUuid: "name:nobody" })));
    await page.goto("/players");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
```

Fixtures to add (names illustrative; bind to the repo's mechanism): `backups-healthy`, `backups-recovery-required` (job `6efb490a-65c2-4d17-b0f0-4536d0524d42`, stage index 6, `errorCode: STOP_TIMEOUT`, service `online`), `backups-provider-not-configured`, `backups-legacy-host`, `countdown-backup-active`, `overview-one-player`, `performance-live`.

### 4.5 Manual smoke (against a staging Host, never production first)

1. Latched recovery with Minecraft up → click `Verify Running & Clear Recovery Gate` → band disappears, `Create full backup` re-enables, job `6efb490a…` shows `FAILED` with `STOP_TIMEOUT` preserved in history.
2. Rename the rclone config → preflight shows `NOT_CONFIGURED`, ribbon cells 1 to 3 still green, `Local VPS only` creates a `VERIFIED_LOCAL` zip and the rail marks the off-site stages `skipped`.
3. Restore the config → `Promote to Drive` uploads that archive while Minecraft stays up.
4. Start a 5-minute backup countdown → header pill counts down on every route, header stays 56 px, `Quick Backup` disabled while it runs (the Host rejects a second job).

---

## Definition of Done

- [ ] Binding Table delivered; every `⟨BIND⟩` resolved; no invented symbols.
- [ ] §4.1 and §4.2 all green; core-hash check reports **zero drift** in the 27 locked files.
- [ ] All 25 pre-existing structural invariants pass, plus the 5 additions in §4.3.
- [ ] Stage count, `Stop service` ordinal and off-site stage range derived from the Java enum, not hardcoded; any discrepancy with this document listed in the report.
- [ ] Host changes are additive only; verified against an old Dashboard build (`bd6efa6`) and an old Host with the new Dashboard (§0.5).
- [ ] No version bump beyond `6.0.0`, no push, no destructive git operation, no deletion of `src/ui/**` or `app/**`.

## Final report format (to the user, concise)

1. One-paragraph outcome.
2. Binding Table.
3. Per repo: commits and files changed.
4. Test and verification results (command, pass or fail counts).
5. Deviations from this spec and open risks (e.g. adapter param passthrough, stage-enum differences).
6. Any item you stopped on under §0.4 or a hard stop condition.
