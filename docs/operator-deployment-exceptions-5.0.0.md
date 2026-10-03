# Explicit operator exceptions for the 5.0.0 staging rollout

Schema 1 still requires executed backup, off-VPS integrity, rollback and operator readiness evidence. Schema 2 permits a staged VPS migration to record individual operator exceptions without labeling those checks PASS. The committed receipt remains HOLD; this change does not deploy or approve an exception.

Both modes require positive accepted Core/Dashboard CI run IDs, exact accepted source ancestry, a receipt-only activation commit and a clean working tree. Vercel previews and non-main deployments remain held. There is no environment-variable bypass. The operator readiness check cannot be waived.

A schema 2 receipt must retain the legacy installations, explicitly mark runtime certification NOT_EXECUTED, and contain an approved operator decision with a UTC confirmation timestamp, a reason, exact accepted source commits and the node ID, server ID and instance key for the rollout. Each exception must be named once and have its matching honest evidence status:

| Exception | Required evidence status |
| --- | --- |
| currentOperationalBackup | SKIPPED_OPERATOR_DECISION |
| offVpsIntegrity | SKIPPED_OPERATOR_DECISION |
| rollbackRehearsal | NOT_EXECUTED_OPERATOR_ACCEPTED |

Checks omitted from the exception list must still be PASS. OCI remains SKIPPED_OPERATOR_DECISION under the existing policy. Unknown or duplicate exceptions, missing approval/scope, unaccepted sources, incomplete evidence and runtime certification claims fail closed. Successful schema 2 evaluation returns OPERATOR_EXCEPTION_FIVE_STAGING_DEPLOYMENT, distinct from the fully evidenced schema 1 result.

For the PlexonCraft migration, the operator has chosen to skip a new backup and off-VPS verification. On 2026-10-03, the VPS relay switched to retained 3.5.0, passed local/public build and loopback checks, then restored 5.0.0 with instance configuration and identity unchanged. A separate Vercel production alias rehearsal switched 4.0 commit `398dc57` to retained `8f05f11` and back; public `/api/build` checks passed at 20:26:34Z and 20:28:09Z. These rehearsals cover control-plane runtime/alias recovery. They do not certify world-data recovery, the future 5.0 Dashboard runtime, or two-instance operation. Keep the activation receipt HOLD until operator readiness and exact accepted source CI are verified.

Schema 2 receipts authorize Dashboard deployment for the staged VPS migration. The existing standalone relay remains behind Caddy. The gate's `worker_allowed` output stays false for that mode, and the Cloudflare workflow consumes that separate output. Schema 1 and ordinary 4.0 retain their existing Worker authorization behavior; held, dirty and preview deployments cannot authorize Worker publication.

After merging a gate change, accept its exact post-merge source only after the full CI run succeeds. Runtime application sources have not changed in this patch, but the deployment and release manifest revisions must still remain traceable. Do not relabel an older artifact as a newly built one. Verify the public Dashboard and relay identities and contracts after activation, and preserve artifact source provenance when recording the deployment revision.
