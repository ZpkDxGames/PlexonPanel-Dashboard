# ADR: Agent-owned player and console history

Status: proposed for review (2026-09-26)

## Decision

Use Paper's opt-in local presence journal for the Players Activity modal and the
Host Companion's systemd-journald query for Console. Both already expose bounded,
signed Protocol 3 actions with independent agent-side policy and per-device
responses. The dashboard will query these sources when a view opens, and keep
only bounded live presentation state in memory. No relay database, Firestore,
spreadsheet, or browser archive is added as a source of truth.

```
Paper presence journal -- players.history.list --> signed relay --> paired browser
Paper live presence --- players.presence --------> signed relay --> paired browser
Host systemd journal ---- console.history[.errors] --> relay --> paired browser
Host live journal ------- console.lines ----------> relay --> paired browser
```

The Vercel dashboard supports Cloudflare Worker/Durable Object and standalone
Node relay runtimes. Neither persists player or console bodies. This decision
keeps that boundary the same in both runtimes. The deployed relay runtime, local
Paper configuration, Host journal retention and disk/backup policy still need
operator verification; repository examples are not evidence of live settings.

## Threats and controls

Player identities and console lines are sensitive. A stolen browser credential,
an old scope grant, a compromised relay, or a broad journal reader could expose
them. Existing immutable device grants, signed agent sessions, origin checks,
private action responses, Paper `players.history.view` policy, Host full versus
errors-only authorization, locally pinned systemd unit, bounded queries, and
Host redaction remain the controls. A live `players.view` grant alone cannot
read durable history. An Owner grant cannot enable Paper's disabled journal.
The browser never uploads its legacy localStorage activity archive to Paper.
No history query or response enters persistent browser cache or a URL.

## Limits and operation

`player-history.enabled` defaults to false. The operator must approve the
privacy purpose, choose retention and storage limits, protect/back up the
presence directory, enable it locally, and re-pair only devices that should
receive the immutable history scope. Events while journaling was disabled are
unrecoverable; crash recovery can mark an unknown disconnect without inventing
a leave time. Paper must be online to answer queries. Paper's configured scan,
time, byte, page and retention bounds may return an incomplete window.

Host history is only what its configured systemd journal still retains and can
read. The Host must be online; Paper may be offline. The Host caps pages at 100
and bounds scan, bytes and time. Console text search in this change covers
loaded pages only; it is not server-side full-text search. Pages and live lines
are deduplicated by journal cursor where supplied. Neither source can recover
data already rotated away or never observed by the agent.

This adds no cloud bill, new credentials, migration, or relay write load. It
does not claim offline-agent reads, independent archival retention, or a known
daily console volume. If those become requirements, measure actual daily volume,
disk/backup headroom and privacy requirements first, then review a separate
permissioned archive design and its two-runtime behavior. Firestore would
require an explicit project, region, budget, retention and credential decision.

Rollback the dashboard PR to restore the previous UI without deleting either
agent-owned journal. The old browser activity archive is unverified and remains
separately viewable only as a legacy local archive; it is never merged into
trusted results. Mixed-version agents report unavailable capabilities rather
than fabricating history. Production acceptance still requires the operator's
closed-tab, cross-device, restart and journald-rotation checks.
