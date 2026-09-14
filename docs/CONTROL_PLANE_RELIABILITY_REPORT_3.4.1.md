# PlexonPanel Dashboard 3.4.1 — control-plane reliability report

## Certification state

| Gate | State | Evidence |
| --- | --- | --- |
| SOURCE PASS | Pending CI | Canonical manifest, Worker/standalone E2E contract tests, build identity and bounded diagnostics are implemented on the fix branch. |
| CI PASS | Pending | Must be taken from the accepted PR head; never inferred from source review. |
| DEPLOYMENT PASS | Pending | Dashboard and production relay must both report the accepted `main` SHA. |
| LIVE RUNTIME PASS | Pending | The real Backups `Run backup diagnostics` action must reach Host and return Host-authoritative data. |

No later gate may be inferred from an earlier one.

## Source findings

The accepted baseline before this fix was `8b68f32423efb56eda1c535b7c3e36ea5a30a5e7`. Both the browser and relay source at that revision already contained:

```text
backup.preflight -> backup.view
```

However the rule was independently hand-maintained in `lib/scopes.ts` and `relay/src/scopes.ts`. That architecture allowed browser and relay authorization metadata to drift and had already required two separate alias fixes.

The Worker and standalone relay action paths both:

1. resolve the action to a required scope;
2. require that scope on the paired device;
3. require the selected agent's local capability;
4. route `backup.*` actions to Host;
5. preserve the browser request ID in `action.request`;
6. return `action.result` only to the requesting device.

The related Java Protocol 3 `Scopes.java` already maps `backup.preflight` to `backup.view`. No Java protocol change, Owner bypass, scope grant, registry edit, or forced re-pair is justified by the source evidence.

## Architectural remediation

`protocol/action-scopes.json` is now the single checked-in Dashboard/relay action-scope authority. `lib/scopes.ts` and `relay/src/scopes.ts` are generated from that manifest. `npm run scopes:check` fails CI when generated authorization artifacts drift.

A dedicated contract test exercises the production-shaped case:

```text
role        Owner
scope       backup.view
Paper       connected
Host        connected
Host cap    backup.view=true
action      backup.preflight
agent       HOST
```

The Worker and standalone implementations must both queue the request to Host without `SCOPE_DENIED`, preserve the request ID, accept a Host `SUCCESS` result, and keep that result private to the requesting browser.

## Deployment identity remediation

Dashboard `/api/build` and relay `/healthz` expose bounded non-secret build identity:

```text
version
gitCommit
buildTimestamp
protocolVersion
runtimeKind
```

The Settings diagnostics workspace compares Dashboard and relay commit identities. Missing identities remain `Unverified`; different commits display an explicit control-plane deployment mismatch.

The production relay workflow stamps the accepted `main` SHA into the Cloudflare deployment and verifies `/healthz` reports that exact SHA after deploy. It fails closed when required Cloudflare credentials or the configured production relay URL are absent.

## Rejection diagnostics

Action errors preserve safe diagnostic context where the boundary is known:

```text
requestId
action
agentKind
code
rejectionBoundary
requiredScope
runtimeKind
```

A `dashboard.action_rejected` with `SCOPE_DENIED` is identified as `RELAY_SCOPE`. A signed Host action result with the same code is identified as `HOST_SCOPE`. These fields are diagnostic metadata only; authorization behavior is unchanged.

## Production root-cause status

The pre-fix live evidence establishes that the valid Owner registry contained `backup.view` and that the failed click did not produce a matching Host denial. That narrows the historical failure to a boundary before successful Host delivery, but it does **not** by itself prove whether the rejecting production component was a stale Worker, a different relay runtime, stale room/session metadata, or another pre-Host relay path.

The exact historical production rejection boundary therefore remains **not certified** until the deployed build identity and a correlated live request ID are captured. Do not relabel this as a proven stale-Worker root cause merely because that hypothesis fits the symptoms.

## Mandatory live closure record

After merge and deployment, append the observed values before declaring the incident closed:

```text
Dashboard commit:
Relay commit:
Dashboard deployment id:
Relay deployment id:
Relay runtime:
Deployment timestamps:
Paper version:
Host version:
requestId:
Rejection boundary (if any):
Host action evidence:
Preflight result:
```

Acceptance requires the existing Owner device to work without re-pairing, a browser refresh/reconnect to continue working, and a controlled relay reconnect/redeploy to continue working.
