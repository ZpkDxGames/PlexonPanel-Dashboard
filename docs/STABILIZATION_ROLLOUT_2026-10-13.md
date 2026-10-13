# Stabilization candidate handoff — production withheld

This is a review candidate for the 2026-10-13 directive. Dashboard remains 6.5.2 and Paper/Host remain 5.0.0; no stable version bump, merge or production deployment is authorized by a test result alone.

## Exact provenance

- Dashboard baseline: `51d433e865bdf5053e1819ec64406dc956655e79` on `revamp/6.5.0`.
- Core baseline: `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128` on `main`.
- Dashboard review: https://github.com/ZpkDxGames/PlexonPanel-Dashboard/pull/84
- Core review: https://github.com/ZpkDxGames/PlexonPanel/pull/101
- Core candidate: `4ac9ae794c9406dec03e078a2c57ffd07351e2e6`, tree `cd6c3b0b3057c3fd51cd2d64cc80665498bca86a`.
- Core CI: https://github.com/ZpkDxGames/PlexonPanel/actions/runs/38391597302 — Java 25, x64 and ARM64 passed, 302 tests per architecture, zero failures/errors/skips; check, Javadoc and package gates passed.
- Core CI artifact: https://github.com/ZpkDxGames/PlexonPanel/actions/runs/38391597302/artifacts/11808424231
- CI built PR merge commit `eee49b74bc5f915c91895b148fa4d97487449fba`; both JARs match the locally tested candidate byte for byte.
- The archive's inherited release-manifest contains older Dashboard/rollback references. It is NOT a current matched production release manifest. Use the provenance and live gates in this handoff; rebuild exact-main artifacts after approved merge.

| Artifact | SHA-256 |
|---|---|
| PlexonPanel-5.0.0.jar | `fba64276ab76f01c4762bf5e6c41089317329e482930e56055bb2cbf75e81f23` |
| plexonpanel-host-5.0.0.jar | `d56b320143f272b472553e84591c3694cce4f9b31f1e2b6d5c5f52f16156183e` |

## Actual backup diagnosis boundary

The live failing path is unknown. The existing walker already prunes configured exclusions in preVisitDirectory and visitFileFailed. No evidence establishes that pruning as the live failure. The source change adds validated relative-path evidence to preflight/archive errors and durable failure messages. It does not resolve the real BACKUP_SOURCE_UNREADABLE cause by itself.

Required access: authorized VPS SSH execution, and an Owner-capable paired Dashboard session or operator-run signed actions for TonimSMP and PlexonCraft. Inspect each instance's exact units/users/root, loaded include/exclude settings, backup destination, rclone config and writable token location, current service/RCON readiness, durable maintenance/recovery state and archive partials. Never disclose private identities, RCON secrets, provider tokens or full configuration in reports.

Use backup.preflight, maintenance.status, backup.full.list and service status. Record the failing safeRelativePath and error stage. Inspect namei/getfacl only for that path and necessary ancestors; test read/traverse as the exact Host user. Classify before correction:

- Excluded sensitive content: preserve unreadability; fix the loaded exclusion/pruning only if proved wrong.
- Required durable content: grant only the proven missing file read or ancestor traversal, preserving unrelated effective ACLs.
- Stale root/include: correct only the confirmed configuration error.
- Unknown/racing failure: retain the failure and collect evidence.

Do not recursively grant Host read access. Never edit durable state files to clear recovery. Signed maintenance.recovery.resolve requires known/running Minecraft as expected, successful RCON readiness, no destructive job active and understood partials. Existing Host verification stays intact.

## Controlled paired rollout

Exact live unit/JAR paths must be inspected before these commands are made instance-specific. Repository examples use minecraft@tonimsmp.service and plexonpanel-host@tonimsmp.service, with roots under /srv/plexonpanel/servers/tonimsmp; analogous PlexonCraft names exist. These examples are not fresh live observations.

1. Confirm an idle safe maintenance boundary, warn/save players, preserve off-VPS backup coverage, and record current hashes/unit states.
2. Set MC_UNIT, HOST_UNIT, PAPER_JAR, HOST_JAR, CANDIDATE_DIR and a NEW private ROLLBACK_DIR from the inspected VPS. Verify ordinary single-link JAR files, no symlink components, exactly one installed Paper plugin JAR, compatible Java 25/schema 5/Protocol v3 and correct paired identities.
3. Inspect systemctl show/cat privately. Preserve config, units/drop-ins, identity, device grants, policies and secrets. This patch introduces no configuration-schema migration and does not require replacing config with examples.

Run in a fresh Bash shell with inspected, nonempty variables:

```bash
set -euo pipefail
: "${MC_UNIT:?}" "${HOST_UNIT:?}" "${PAPER_JAR:?}" "${HOST_JAR:?}" "${CANDIDATE_DIR:?}" "${ROLLBACK_DIR:?}"
cd "$CANDIDATE_DIR"
printf '%s\n' \
 'fba64276ab76f01c4762bf5e6c41089317329e482930e56055bb2cbf75e81f23  PlexonPanel-5.0.0.jar' \
 'd56b320143f272b472553e84591c3694cce4f9b31f1e2b6d5c5f52f16156183e  plexonpanel-host-5.0.0.jar' | sha256sum --check -
sudo test ! -e "$ROLLBACK_DIR"
sudo test ! -L "$ROLLBACK_DIR"
sudo install -d -o root -g root -m 0700 "$ROLLBACK_DIR"
sudo cp --preserve=all -- "$PAPER_JAR" "$ROLLBACK_DIR/Paper.previous.jar"
sudo cp --preserve=all -- "$HOST_JAR" "$ROLLBACK_DIR/Host.previous.jar"
sudo sha256sum "$ROLLBACK_DIR/Paper.previous.jar" "$ROLLBACK_DIR/Host.previous.jar"
sudo systemctl stop "$HOST_UNIT"
sudo systemctl stop "$MC_UNIT"
test "$(systemctl show "$HOST_UNIT" -p ActiveState --value)" = inactive
test "$(systemctl show "$MC_UNIT" -p ActiveState --value)" = inactive
# Inspect shutdown/save logs; a timeout or forced kill requires investigation.
sudo test ! -e "${PAPER_JAR}.candidate"
sudo test ! -L "${PAPER_JAR}.candidate"
sudo test ! -e "${HOST_JAR}.candidate"
sudo test ! -L "${HOST_JAR}.candidate"
sudo cp --preserve=all -- "$PAPER_JAR" "${PAPER_JAR}.candidate"
sudo cp --preserve=all -- "$HOST_JAR" "${HOST_JAR}.candidate"
sudo sh -c 'cat "$1" > "$2"' sh "$CANDIDATE_DIR/PlexonPanel-5.0.0.jar" "${PAPER_JAR}.candidate"
sudo sh -c 'cat "$1" > "$2"' sh "$CANDIDATE_DIR/plexonpanel-host-5.0.0.jar" "${HOST_JAR}.candidate"
test "$(sudo sha256sum "${PAPER_JAR}.candidate" | cut -d' ' -f1)" = fba64276ab76f01c4762bf5e6c41089317329e482930e56055bb2cbf75e81f23
test "$(sudo sha256sum "${HOST_JAR}.candidate" | cut -d' ' -f1)" = d56b320143f272b472553e84591c3694cce4f9b31f1e2b6d5c5f52f16156183e
sudo mv -T -- "${PAPER_JAR}.candidate" "$PAPER_JAR"
sudo mv -T -- "${HOST_JAR}.candidate" "$HOST_JAR"
sudo systemctl start "$MC_UNIT"
sudo systemctl start "$HOST_UNIT"
sudo sha256sum "$PAPER_JAR" "$HOST_JAR"
systemctl show "$MC_UNIT" "$HOST_UNIT" -p ActiveState -p SubState -p MainPID
```

Inspect journals and paired sessions and prove Host RCON readiness. Active systemd state alone does not establish Minecraft readiness. Retaining the existing JAR paths avoids unnecessary unit changes. Do not hot-reload Paper. A crash between the two atomic moves requires verifying/restoring the complete pair before startup.

## Mandatory live certification, each instance

All gates below remain NOT EXECUTED:

- Uptime increments from processUptimeMillis; same-session reconnect preserves it; Paper restart resets it; prior session cannot reappear.
- Console loads/follows Host journald; Paper executes /list and /tps; /save-all follows policy; confirmed safe and denied high-risk flows work; failed commands do not enter successful history.
- Observe CPU and Memory for several minutes at 30s/1min/5min/10min, idle/join/leave/chunk load/world generation/spike, Paper restart and safe Host reconnect. Verify independent capture times, sessions, cadence gaps, source labels, stable scale and hover.
- Real cold backup: preflight → countdown → save-all flush → exact service stop → prove inactive → archive configured content → local hash/verification → offsite upload → remote verification → retention cleanup → restart → Paper/Host/RCON ready → durable COMPLETED → Dashboard updates.
- Verify offsite object identity/size/hash or provider verification result; upload exit status alone is insufficient.
- Safely induced provider failure retains local backup and Degraded state; retry verifies offsite without a second shutdown.
- Browser closure cannot cancel Host job; reconnect reconstructs durable state; idle Host/Paper restarts and server switching cannot leak stale jobs.
- Inspect partials/recovery after safe simulated failure before signed recovery resolution.
- Responsive live browser gates for all six directive sizes, both motion preferences and all specified routes.

## Production and rollback

After source, browser and controlled live acceptance, merge matched Core fixes, rebuild both exact-main artifacts and record fresh provenance/hashes. Roll out and revalidate. Then merge/version the Dashboard, require merged-commit CI, deploy that exact commit to Vercel, verify production build.json identity and final smoke. No production deployment ID/URL is claimed here.

For idle rollback, stop the exact Host/Minecraft units, verify inactive, restore BOTH saved JARs to their original paths with cp --preserve=all, compare hashes with recorded originals, then start and prove Paper/Host/RCON readiness. Never interrupt an active backup merely to roll back; investigate a safe terminal/recovery boundary. Preserve durable state, inventory, partials, identity and config. Any narrow live config/ACL correction needs its own recorded reversal. The previous verified Vercel deployment must be recorded before promotion; none was selected here.

The workspace connection was restored after an interruption. Candidate JAR hashes were rechecked locally and CI screenshots were inspected. The remaining live infrastructure boundary is VPS execution and an Owner-capable paired session; fixture results cannot substitute for that evidence.
