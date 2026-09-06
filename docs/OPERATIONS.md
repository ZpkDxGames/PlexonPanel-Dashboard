# Dashboard operations and privacy

Settings/Access show current scopes and locally advertised capabilities. Disabled actions may require a scope, enabled local capability, connected source agent or literal Owner. Security policy changes only locally.

Connectivity distinguishes unpaired, expiry/revocation, protocol mismatch, relay unavailable/reconnecting and Paper/host offline. Cached charts are stale. Host presence does not imply Minecraft runs; restart success waits for authenticated Paper reconnection.

Server workspaces isolate credentials/cache by UUID. Received logs/chat/plugin names/files are text, never executable HTML. The file editor supports allowed UTF-8 up to 24 KiB, JSON validation, hash conflicts with retained drafts, original/edited review, Ctrl/Cmd+S and unsaved-navigation warnings. SQL is read-only, binary writes forbidden; other text-format syntax is the operator's responsibility.

General downloads max 8 MiB, backup downloads max 64 MiB, with ordered 16 KiB chunks, cancellation/expiry and final SHA-256 before download. Larger archives use local administration/configured rclone. File bodies/action outputs never enter persistent cache or relay storage.

Restore requires Owner, local enablement, stopped Paper, a short-lived device/archive-bound nonce, typed server name and final confirmation. Success leaves Paper stopped. Recovery-required is handled locally; dashboard cannot bypass the journal.

History caps at 361 five-second samples/30 minutes, live console 600 lines and chat 200; the smaller cache expires in one hour. Sensitive player address/location is removed from cache. Bearer credentials persist until expiry/forget, subject to immediate revocation. Use a trusted private browser profile.

Audit reads bounded local JSONL with filters/50-entry pages, excluding command/message/file bodies and secrets. Last-seen means last successful authorized activity, throttled to one minute. A lost browser should be revoked locally.

The relay sees transient routed data; TLS is not end-to-end encryption against it. Provider request metadata follows account policy. Restrict full console/chat and use sanitized diagnostics. A disconnected/timed-out request has an unknown outcome and is never resent automatically; inspect audit/server state before retrying.
