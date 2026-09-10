# Phase 2 security review — dashboard and relay

Scope: dashboard client, Protocol 3 relay participants, standalone relay runtime and migration path for PlexonPanel 3.2.0-rc.1.

## Reviewed boundaries

- Browser state is not execution authority. Server/host components re-authorize privileged work.
- Pairing grants originate at Paper; the relay cannot accept a client-selected role or scope escalation.
- Pairing registrations expire and are consumed through the Paper approval path; pairing attempts are rate-limited.
- Stable server identity is bound to agent public keys, not to a dashboard display name.
- Agent handshakes require protocol 3, correct component kind, Ed25519 identity verification, a fresh challenge and per-session sequence state.
- Wrong-room messages, duplicate/stale message IDs and stale session sequences are rejected.
- Privileged operations use request IDs and capability/scope filtering; offline transport does not create an unbounded command backlog.
- Standalone relay configuration rejects wildcard origins, non-loopback plaintext origins, missing/weak secrets, mismatched relay keys and accidental public binding.
- Coordination persistence is bounded metadata. Telemetry, console, chat and command payload history are not persisted.
- Connection counts, handshake lifetime, message size and rate-sensitive paths are bounded.

## Findings

No HIGH or CRITICAL defect was identified in the reviewed Phase 2 source candidate. Runtime exposure, Tunnel routing, service permissions and multi-server isolation still require the dedicated PlexonCraft end-to-end gate; this source review does not substitute for runtime certification.
