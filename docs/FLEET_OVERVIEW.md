# Fleet overview

The Fleet workspace observes paired servers through room-bound signed read subscriptions. The selected workspace retains the only action socket. Passive subscriptions never bind the action channel, persist private console data or expose browser credentials through their snapshots. Unmounting closes subscriptions and timers; unchanged roster entries reuse their sockets. There are at most sixteen simultaneous subscriptions including the selected workspace. An additional paired server can be selected to prioritize it.

Each card shows Paper and Host availability, current players, TPS/MSPT, systemd Minecraft-service CPU and memory, and last-sample time. Stale, missing, revoked and offline data remains explicitly unavailable. CPU accounting uses percent of one core, so 150% means 1.5 cores. A stopped Minecraft service does not imply its Host is offline.

Node totals use authenticated fleet associations and one fresh Host sample per node. Shared-node memory, CPU and the sampled filesystem are never summed per instance. Filesystem figures describe the reporting Host's sampled filesystem; they do not claim to aggregate every mount on the node. Minecraft JVM/process telemetry is not a fallback source for node totals. Agent-session changes discard old metrics and delayed events.

Tests execute subscription isolation/reuse/rotation/revocation/limits, stale and absent accounting, shared/separate-node aggregation, stale Host rejection, namespaced credential removal and accessible server navigation rendering. These are automated source-level checks. Browser and actual simultaneous-server VPS certification remains a separate unexecuted production gate.
