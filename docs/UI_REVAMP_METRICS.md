# Metric and authority inventory

No collector, packet frequency, scope, protocol, relay persistence or JAR change. Wire protocol 3 and agent schemas 5 remain unchanged. Capture time determines freshness (30 seconds; 5 seconds future tolerance), separately from browser receipt time. All numeric fields are finite/nonnegative or null; zero is a valid reading.

| Metric | Scope / authority | Existing field, unit | Capture / cadence | Permission / unavailable | Retention / consumers |
|---|---|---|---|---|---|
| TPS | Instance / Paper health | telemetry.server.tps[0], ticks/s | body.capturedAt; 40 ticks default | server telemetry grant/capability; null/stale means unavailable | bounded browser; Fleet, Overview, reports |
| MSPT | Instance / Paper health | averageTickMillis, ms | same Paper health capture | same; no synthesized zero | same |
| Players | Instance / Paper health | onlinePlayers, count; maximumPlayers capacity | same Paper health capture | server telemetry; roster details separately gated | numeric history only; Fleet/Overview/reports |
| JVM heap | Instance / Paper JVM | jvmHeapUsedBytes, jvmHeapMaximumBytes, bytes | telemetry.system.capturedAt / declared source interval, otherwise configured default 5 s | Paper system capability; absent/stale unavailable | numeric browser history; Overview/reports |
| Paper CPU | Instance process / Paper JVM | processCpuPercent, % machine CPU capacity (MXBean getProcessCpuLoad) | Paper system source capture | Paper system authority; independently absent | reports, never systemd one-core CPU |
| GC pauses | Instance / Paper JVM | gcPauseTotalMillis, cumulative ms | Paper system source capture | same; cumulative since process start | scoped export, latest source statistics |
| Service CPU | Instance / Host exact unit | service.status.resources.cpuPercent, % one CPU core | resources.capturedAt; 5 s default | authenticated Host; MINECRAFT_SERVICE / SYSTEMD_CGROUP / PERCENT_OF_ONE_CORE; cpuAvailable true | Fleet/Overview/reports; 150% = 1.5 cores |
| Service RAM | Instance / Host exact cgroup | resources.memoryBytes, bytes | same service resource capture | Host; memoryAvailable true | Fleet/Overview/reports; not JVM heap |
| Node CPU | Shared node / Host | hostCpuPercent, % machine capacity | Host system capturedAt; 250 ms default | bound node, HOST role, NODE scope | shared node shown once in Fleet; explicitly shared-node report |
| Node RAM / filesystem | Shared node / Host | physicalMemoryUsedBytes/TotalBytes; diskUsedBytes/TotalBytes/UsableBytes | same Host system capture; filesystem sampling has its own collector limits | same; absent unsupported storage metrics unavailable | Fleet deduplication; numeric RAM reports / latest source stats |
| Load averages | Shared node / Host | loadAverage1m/5m/15m, runnable + uninterruptible tasks | same Host system capture | fresh Host only | latest source stats, no browser-derived 24h average |
| Tick extrema / p95 | Instance / Paper | minimumSampleTickMillis, p95TickMillis, maximumSampleTickMillis | health capturedAt | fresh health only; supplied Paper statistics | latest source panel; separate from browser sample p95 |
| Process uptime / RSS | Instance / Paper | processUptimeMillis, ms; processRssBytes, bytes | JVM system capturedAt | fresh JVM only | Overview uptime / latest source panel |
| Worlds | Instance / Paper | telemetry.worlds.worlds[], name/chunks/entities/players | captured inventory | fresh Paper health for current display | current transient world table |
| Player activity | Instance / Paper | authorized presenceDeltas observedAt; history action private | observed event time / explicit query | players.view / players.history.view and local policy | transient current feed; retained history only queried from Paper |
| Backup progress | Instance / Host job | backup.progress, durable operationId and emitted stage/bytes | signed job capture | backup scopes/capabilities / current operation binding | current per-instance job; indeterminate when unknown |

The reducer stores optional capture times per authority in each bounded history record. The shared metric adapter deduplicates repeated captures so Host packets never increase the number of Paper observations. Older cache records have only packet timestamps; exports label them `legacy packet timestamp`. Missing source time in a new record cannot invent a reading. New field absence remains compatible. No long-horizon storage is introduced.

The graph path breaks at null and at elapsed source gaps (>3 expected intervals, with a 1 s floor). Source cadence is declared when available, otherwise the catalog's documented default. Coverage is observed connected span / requested window; isolated observations contribute zero span. P95 is nearest-rank over actual available values, sample-based. Exports include immutable server ID, metric, capture, value, unit, source and provenance; no player names, file contents, command results or credentials are included.
