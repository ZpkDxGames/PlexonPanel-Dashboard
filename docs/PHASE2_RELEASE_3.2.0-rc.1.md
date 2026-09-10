# PlexonPanel Dashboard 3.2.0-rc.1 — historical candidate

> **Superseded.** This document is retained only as historical Phase 2 evidence. Do not deploy or couple new installations against RC1. The active release boundary is `docs/PHASE2_RELEASE_3.2.0-rc.2.md`.

RC1 preserved the Protocol 3 control-plane architecture and was initially prepared as the matching dashboard/relay source boundary for `v3.2.0-rc.1`. During coupled dashboard certification, the production dependency audit identified HIGH/CRITICAL advisories in the then-current dependency graph. That finding invalidated RC1 as the final coupled Phase 2 boundary without changing the already-published immutable Java `v3.2.0-rc.1` tag/release.

The remediated dashboard dependency graph, including the patched Next.js and Cloudflare tooling line, belongs to **3.2.0-rc.2**. Protocol remains **3**. Stable `3.2.0` remains blocked, and PlexonCraft runtime certification remains **NOT EXECUTED**.

## Historical architecture boundary

The dashboard is presentation and authenticated operator workflow, not execution authority. Paper remains authoritative for Bukkit/Paper actions and Minecraft capability checks; the host companion remains authoritative for explicitly permitted VPS/service actions; the relay transports and routes protocol messages.

The RC1 work established or retained the standalone Protocol 3 relay, Worker rollback path, loopback-by-default binding, exact-origin and secret validation, stable server identity/device grants, bounded connection/session behavior, replay and routing rejection, and coordination-only relay persistence.

## Historical status

- Historical candidate: `3.2.0-rc.1`
- Protocol: `3`
- Java RC1 tag/release: immutable; do not move or replace
- Final Phase 2 candidate line: `3.2.0-rc.2`
- Stable `3.2.0`: unpublished
- Runtime certification: `NOT_EXECUTED`

## Rollback

Dashboard source rollback remains `main` at `03777c7dc108b54dda625c7f56f5e723ca35124f` plus the previously deployed Worker relay configuration. Paired Paper identity or device grants should not be deleted merely to roll back the dashboard/relay source.

For all current candidate deployment and certification instructions, use `docs/PHASE2_RELEASE_3.2.0-rc.2.md`.
