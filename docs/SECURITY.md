# Dashboard security

A browser credential is bound to protocol/audience/server/device/role/scopes/generation/expiry. Relay and executing agent independently verify the current local grant and local capabilities. Origin allowlisting, Ed25519 agent sessions, bounded requests and per-device response routing are mandatory. No client field can elevate its grant.

Production CSP excludes development eval support; received text is escaped. Never put credentials in URLs, NEXT_PUBLIC variables, logs or diagnostics. Use a private browser profile, revoke lost devices locally and review [OPERATIONS](OPERATIONS.md) for cache/privacy limits. Report vulnerabilities privately; do not include actual credentials or player data. Production [acceptance](VALIDATION.md) remains required.
