# Capability matrix

| Capability | Status | Evidence / boundary |
| --- | --- | --- |
| Protocol-3 pairing, stored credential, WSS auth and reconnect | Verified in adapter contract tests | Copied integration modules at pinned candidate commit; bound-session tests pass |
| Fleet passive feeds | Verified | Read-only rooms capped at 16; selection isolation tests pass |
| Paper/Host telemetry and freshness | Verified | Independent receipt clocks, skew and gap tests pass |
| TPS/MSPT, CPU, memory and world density views | Verified / derivable | Raw sources retained; density requires a positive known denominator |
| MSPT p95/p99 | Requires backend integration | Mean samples cannot produce honest percentiles |
| Player roster and UUID-bound typed actions | Verified contract | Controls gated by signed scope, agent capability and active generation |
| Skins | Verified frontend fallback | Direct configurable providers; same-origin proxy is optional and not implemented |
| Presence history | Verified contract, UI deferred | Cursor action exists; current page focuses the live roster |
| Permission tier A | Verified contract | OP/de-op and whitelist actions |
| Permission tier B | Verified builder | Typed LuckPerms commands still depend on the server allowed-command policy and returned output |
| Permission tier C | Requires backend integration | Proposed `permissions.*` contract below |
| Console stream and command execution | Verified contract | 2,500-line bound; Host/Paper authority displayed; result is agent-bound |
| ANSI, legacy and MiniMessage display | Verified unit tests | React text segments only; malformed/adversarial input remains inert |
| Chat stream/send | Verified contract | MiniMessage send remains scope/capability gated |
| Plugin inventory/reload | Verified contract | Reload uses reviewed action and real result |
| Backup preflight/list/status/create/verify/retry/delete | Verified contract | Unknown preflight values never enable create; exact job result remains authoritative |
| Backup download and restore | Deferred UI | Existing contracts preserved; browser save/hash workflow not surfaced in this candidate |
| Device list/revoke and audit | Verified contract | Current-device revoke disabled; audit is query result, not local history |
| File configuration | Intentionally omitted | User edits files from their own PC |
| Relay, theme, density, motion, time zone, skin and diagnostics settings | Implemented | Relay still requires deployment input and allowlisting |
| Thread profiling, retention, economy, anti-cheat, AI/RAG | Requires backend integration | No protocol data; no UI or fake values shipped |
