# PlexonPanel 3.2.0-rc.2 Phase 2 security review — dashboard/relay

Scope: dashboard client, Protocol 3 relay participants, standalone relay runtime, Worker rollback path and migration boundary.

## Reviewed boundaries

- Browser state is not execution authority; server/host components re-authorize privileged work.
- Pairing grants originate at Paper; the relay cannot accept a client-selected role or scope escalation.
- Pairing registrations expire and are consumed through the Paper approval path; pairing attempts are rate-limited.
- Stable server identity is bound to agent public keys, not dashboard display names.
- Agent handshakes require protocol 3, correct component kind, Ed25519 identity verification, a fresh challenge and per-session sequence state.
- Wrong-room messages, duplicate/stale message IDs and stale session sequences are rejected.
- Privileged operations use request IDs and capability/scope filtering; offline transport does not create an unbounded command backlog.
- Standalone relay configuration rejects wildcard origins, non-loopback plaintext origins, missing/weak secrets, mismatched relay keys and accidental public binding.
- Coordination persistence is bounded metadata; telemetry, console, chat and command payload history are not persisted.
- Connection counts, handshake lifetime, message size and rate-sensitive paths are bounded.

## Dependency remediation

The initial Phase 2 candidate exposed a critical Next.js advisory and high-severity image/toolchain findings. The candidate was not frozen. The corrected dependency graph pins Next.js 16.3.4, matching ESLint integration, Miniflare 5.20260910.0-alpha and Wrangler 4.131.0, and CI now executes `npm audit --audit-level=high` before any functional/build gate. The dependency refresh job passed this high/critical audit requirement before these generated lock changes were transferred to the Phase 2 branch.

## Findings

No HIGH or CRITICAL product/security defect remains known in the reviewed Phase 2 source candidate. Runtime exposure, Tunnel routing, Unix service permissions, destructive-action behavior and multi-server isolation still require the dedicated PlexonCraft end-to-end gate; source review and dependency audit do not substitute for runtime certification.
