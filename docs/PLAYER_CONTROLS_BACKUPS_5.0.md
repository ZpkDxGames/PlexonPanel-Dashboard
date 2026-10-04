# Player controls and selected-server backups

The screenshots show an offline UUID resolving to a default head, native dropdowns and a TonimSMP backup preflight stopped at `RCLONE_UNAVAILABLE`. Existing Drive folders do not configure a running Host. This source update addresses the UI and provides a separate reviewed Core setup workflow; it does not claim the VPS or Google Drive has been configured.

## Player heads

The default MCHeads template is `https://mc-heads.net/avatar/{player}/{size}`. A validated public Minecraft texture ID from Paper takes precedence, then a valid account name for offline UUIDs, then an online UUID. Name lookup needs no replacement plugin. Optional applied textures require the companion Core Paper JAR, installed on each instance at its own planned restart. Missing metadata keeps the fallback path functional. Private profile blobs and arbitrary texture URLs are never forwarded.

An explicitly configured legacy `{uuid}` template retains UUID behavior. Unset/blank `NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE` or use the new `{player}` template to enable offline account-name and applied-texture selection. A production rebuild is required after changing this public deployment setting. The provider may cache skins; this change cannot guarantee immediate external propagation. Viewer image requests remain opt-out, lazy, no-referrer and constrained to the configured CSP origin. Failed-image memory is bounded and expires after one minute; changing the identity/texture resets image loading state.

## Shared controls and cleanup

Every active native dropdown is replaced by one compact themed `Select`: keyboard navigation/typeahead, disabled options, controlled values, accessible combobox/listbox semantics, focus restoration and Escape/Tab/outside dismissal. Its menu stays in a native dialog's top layer and is constrained to the viewport. No third-party UI library or blur effect is added. Existing date/time inputs retain their themed styling and native input behavior.

Backup delete, recovery acknowledgement and restart use the shared styled confirmation dialog, with the selected server and operation details. Full-backup review uses a styled native modal dialog for focus containment and Escape cancellation. Cancellation queues no command. Existing permissions, signed target capture, revocation checks, pairing, authentication, WSS and relay rate limits remain authoritative.

One canonical `app/backups-view.tsx` replaces the historical versioned entry point. Obsolete native-select CSS and the superseded backup overlay are removed. The shared control uses a CSS module and one production entry point; no parallel legacy UI is loaded.

## Backup behavior

- The destination panel names the selected server and its signed instance-local archive directory, with setup, loaded-config/restart and recovery guidance.
- An early provider failure leaves later storage/source checks Unknown. A specific storage/source failure marks only that check Failed. A failed or pending refresh disables backup creation even when earlier successful data remains visible.
- Saved safe diagnostics are keyed by server UUID and checked against that UUID before display. One instance's failure does not appear on the other.
- Upload, remote verification and cleanup progress use only signed progress for the current durable job, and never regress behind the durable phase. Other jobs' progress is ignored.
- Maintenance status polls every 15 seconds while idle and every two seconds during an active operation. Hidden tabs pause polling, in-flight status calls do not overlap, and manual full refresh has a five-second cooldown and is disabled during queries. This reduces request bursts without weakening relay limits.

## Deployment and Drive setup

1. Review and merge this source PR and the companion [Core PR #97](https://github.com/ZpkDxGames/PlexonPanel/pull/97). Wait for the exact merged commits' passing CI. Create a separate receipt-only activation with the accepted Dashboard source as immediate parent, following `COORDINATED_DEPLOYMENT_GATE.md`; an earlier activation does not cover changed source. Keep full runtime certification `NOT_EXECUTED` and Worker publication held for the VPS target.
2. Deploy the Dashboard through the existing production path. The dashboard changes work with the current 5.0.0 Host/Paper contracts; preserve the standalone relay, VPS layout, identities and pairing.
3. Follow Core's [instance Drive setup guide](https://github.com/ZpkDxGames/PlexonPanel/blob/codex/instance-drive-backup-setup/docs/INSTANCE_DRIVE_BACKUP_SETUP.md). Start with `sudo python3 scripts/instance-drive-backup.py check` on the VPS from the reviewed Core checkout. Obtain each existing Drive folder's exact URL/ID and authorize a separate private Host-local rclone configuration. OAuth tokens stay on the VPS. No Host JAR replacement is required for first-time provider setup. The helper only configures an inactive selected Host and never stops Minecraft, touches existing archives or overwrites refreshed provider state.
4. For server-applied skins, install the CI-tested Paper JAR on each instance at a planned Minecraft restart. The account-name fallback already works with the old plugin.
5. In each selected workspace, run Test Google Drive and refresh preflight. Schedule a real cold backup separately, review the countdown, then record its job ID, local/remote verification and Minecraft/RCON recovery. Test failures/retry/restoration only with a retained verified restore point and planned maintenance.

The Drive screenshot contains folder names but no folder IDs. No Google OAuth, real Drive upload, VPS permission repair, Minecraft stop/restart or production WSS test was executed in this workspace.

## Validation

`npm run check` passes: scope/fleet contract checks, ESLint, application/relay TypeScript, 79 relay tests, production Next.js build and 167 Dashboard tests. The mounted real Dashboard uses a real loopback relay with signed simulated Paper/Host agents. It verifies two-server switching/reload, abandoned grant cancellation, lifecycle completion, Owner file editing/conflicts, custom dropdowns, instance-scoped backup failures, stale preflight gating, upload progress filtering, full-backup review/cancel/one-target confirmation and independent revocation. Player-head DOM tests verify offline name fallback, applied texture preference and reset after image failure/identity change. Core has separate disposable setup tests and Java texture allowlist tests.

These checks validate source and simulated signed flows. Native-browser visual/mobile certification and the full production VPS/Drive/WSS end-to-end flow remain outstanding.
