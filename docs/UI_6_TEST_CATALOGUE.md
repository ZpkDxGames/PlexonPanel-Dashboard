# M0 test catalogue

Source anchor: `86b6a0cefb2c5e420c9c862a7897705e1ea59146`. Titles are source-extracted; counts in the check log are authoritative execution results.

## action-diagnostics.test.mjs

- verified legacy session payload keeps signed claims without requiring deviceId
- an explicit session action-contract mismatch still fails closed
- invalid signed session contract reports the safe field without deleting credentials
- relay SCOPE_DENIED preserves boundary, action, scope, agent and request ID
- relay UNKNOWN_ACTION is distinct from a missing device scope

## actions.test.mjs

- Host lifecycle completion survives Paper presence and session changes without replay
- Host session or signed grant replacement rejects its pending lifecycle command
- confirmation captured for Server A cannot send on Server B after an asynchronous switch
- a confirmation cannot survive agent or grant replacement on the same Dashboard socket
- action completion must match the original server, socket, action and source authority
- legacy relay rejection without a server field is accepted only from its original bound socket
- relay queue acknowledgement never reports an operation completed
- file conflicts reject with structured status so unsaved edits can be retained
- disconnect rejects uncertain completion and never replays the command
- a stale socket cannot unbind the current authorized connection

## activity-history.test.mjs

- legacy browser archive remains read-only, isolated and unverified
- display cadence cannot persist live presence to the legacy archive
- server-side filters use bounded Paper parameters and opaque cursors
- a live duplicate is replaced by the journal record; pages never mix
- live filters reject malformed rows and do not invent a leave

## avatar-provider.test.mjs

- normalizes dashed and undashed UUIDs to lowercase hex
- uses MCHeads when deployment does not configure an avatar template
- accepts one HTTPS uuid template and derives exact CSP origin
- allows development HTTP only on loopback
- rejects malformed, repeated, secret-bearing, fragment, and unsafe templates
- rejects unsupported sizes and malformed UUIDs without producing a request URL
- applied texture wins, offline UUID uses the real account name, online UUID remains stable

## backup-readiness.test.mjs

- a missing Drive provider does not invent storage or source failures
- new successful Drive preflight supersedes an older degraded provider snapshot
- later provider failures and pending refreshes cannot reuse a successful Drive preflight
- only the failing preflight stage is marked failed
- refresh and unclassified failure do not promote cached success to current readiness

## backups-maintenance.test.mjs

- 3.5 promotes Fully Backup Now with selectable durable countdowns
- Host preflight is authoritative and gates Fully Backup Now
- durable Host job reconstructs the active timeline after refresh
- truthful progress and verification details do not invent an ETA
- degraded and recovery-required states block or recover safely
- automatic backups stay retired while restart-only scheduling remains supported
- stable backup history exposes read-only-safe Host operations
- safe failures remain structured and browser boundary retains provider secrecy
- destructive maintenance actions remain capability-gated at browser and relay boundaries
- responsive Step 8 backup layout avoids global scaling and styles the confirmation surface

## backups-provider-verification.test.mjs

- provider view keeps latest test and last remote verification as distinct Host-authoritative fields

## browser-store.test.mjs

- removing background A atomically preserves selected B and B's credential/cache
- a slow earlier selection cannot overwrite a newer selection in browser storage
- server labels are presentation metadata, persist independently and are removed only with their server

## chart-geometry.test.mjs

- series statistics preserve zero as a real value
- empty and all-null series stay unavailable
- gap segmentation never connects across missing samples
- high-frequency SVG thinning stays bounded and preserves local extrema
- percentage, capacity and adaptive domains are stable and truthful
- nearest selection clamps naturally to first/last available value
- window filtering uses the newest sample as the browser-local tail
- SVG paths create separate subpaths and close area fills at the baseline

## connection-state.test.mjs

- a fresh Host confirmation distinguishes stopped Minecraft from Host and relay loss
- cached, expired, missing and inconsistent signals cannot fabricate stopped status
- service transitions, failure and running process without plugin are distinct
- compatibility, revocation, stale telemetry and subscription limits remain explicit
- connection summaries expose readable status and retry controls without color dependence

## console-history-authority.test.mjs

- console history actions reuse the existing least-privilege view scopes
- console UI queries Host explicitly and discloses journald retention
- relay adapters expose explicit Host, Paper fallback, and unavailable authority states

## control-state.test.mjs

- CPU zero is a real sample and Paper process metrics never masquerade as Host metrics
- Host telemetry owns machine CPU and memory while Paper remains independently unavailable
- telemetry history uses trusted source capture timestamps at sub-second cadence
- same captured instant replaces rather than duplicates a chart sample
- unrelated telemetry snapshots do not duplicate performance history
- high-frequency telemetry history remains strictly bounded
- cross-server and incompatible-ready events cannot contaminate the workspace
- inventory pagination never combines snapshots or appends a missing first page
- presence deltas are idempotent and an old session cannot remove a reconnect
- a complete snapshot replays only deltas newer than its capture
- console and cache remain bounded and exclude players, files and action results
- console journal identifiers and short cross-source transitions suppress duplicates
- UI actions require the intersection of exact scopes and local capabilities

## coordinated-deployment.test.mjs

- operator exceptions distinguish staged deployment from executed evidence
- incomplete, unapproved and overbroad operator exceptions fail closed
- five is held until exact accepted source and executed coordination evidence
- committed receipt cannot authorize unrelated fixture ancestry
- Vercel ignore and explicit build exit conventions agree for the current receipt
- actual activation ancestry, dirty source, preview hold and Vercel exit codes
- Cloudflare deployment consumes the Worker-specific authorization

## cpu-load.test.mjs

- preserves a valid idle CPU sample
- rounds and clamps valid CPU samples
- marks missing and negative CPU samples unavailable
- prefers a host CPU sample over the Paper process sample
- falls back to Paper process CPU when host CPU is unavailable
- reports unavailable only when both CPU samples are unavailable

## create-vercel-env.test.mjs

- creates the one-variable Vercel import without Firebase credentials
- rejects non-HTTPS relay URLs and accidental overwrites

## custom-controls.test.mjs

- custom select supports arrows, disabled options, typeahead, Enter, Escape, Tab and outside dismissal
- custom dropdown belongs to its dialog and unmount removes the portaled menu
- player heads use applied textures and reset load/failure state when the identity changes

## dashboard-2-1.test.mjs

- active service disables Start and allows stop/restart
- inactive service allows only Start
- transitioning and unknown service states block lifecycle actions
- failed service permits recovery Start but not stop/restart
- Paper connection only fills missing service state and never overrides explicit inactive
- known action codes map to safe actionable guidance
- unknown action codes retain the sanitized agent message
- lifecycle busy explains rejection without suggesting a deferred stop
- safe diagnostics identify Dashboard 5.0.0 without changing protocol 3
- live actions are bound to the exact signed socket grant
- preconfirmed maintenance actions are sent once with confirmation

## dashboard-3-0-scope.test.mjs

- Dashboard 5.0.0 exposes the active manual-only Backups workspace
- Backups workspace is wired only to supported Host manual maintenance actions
- Dashboard and relay expose identical maintenance/provider scopes
- legacy backup.create scope remains compatibility-only and is not an active dashboard action
- retired Paper coordination protocol cannot return
- Dashboard 5.0.0 keeps protocol hooks compatible with a selected-server Configuration workspace
- Dashboard visible version metadata matches package 5.0.0
- Dashboard 5.0.0 responsive architecture does not globally scale the interface
- Step 8 Backups workspace has responsive production layout
- Dashboard 5.0.0 display update rate exposes every supported browser cadence
- production loads one canonical global stylesheet without legacy overlap

## dashboard-flow.test.mjs

- mounted Dashboard selects and operates independent signed instances without stale transitions
- opening selector shows live named cards and remembers the selected server
- switch resets data and confirmation before a second signed workspace becomes live
- rapid A to B to A dropdown switches establish a fresh live command channel
- a delayed session grant for an abandoned selection cannot replace the current socket
- reload returns to the selector while preserving selection and independent page history
- lifecycle commands complete across real signed Paper disconnect and reconnect events
- a busy stop stays visible in lifecycle controls without delayed or automatic replay
- Owner configuration uses Paper editing, reviews changes and preserves conflicts and unsaved work
- backup setup is instance-specific, unverified checks stay unknown and cached preflight cannot authorize a new job
- signed upload progress is shown for the active Host job and ignored for other jobs
- cold backup review cancels without a command and confirms only the selected Host
- Host-confirmed stop, agent disconnect and relay disconnect are different UI states
- revoking one paired server keeps the other available and selectable

## device-grant.test.mjs

- device permissions use the intersection of signed and reported scopes
- matching signed and reported grants remain fully available
- device or role disagreements fail closed
- active dashboard and access views consume the reconciled signed grant

## display-cadence.test.mjs

- critical and operational state bypasses the presentation throttle
- telemetry and bounded inventory remain presentation-throttled
- display rate labels distinguish realtime from bounded cadence

## five-build-contract.test.mjs

- five build verification requires coordinated version, protocol, action and fleet contracts

## fleet-contract.test.mjs

- fleet fixtures cover two servers on one node and independent nodes in both runtimes
- renaming keeps routing identities and exact systemd target unchanged
- same server on a substituted node is a different target
- unit injection, invalid identifiers and control characters fail without echoing input

## fleet-overview.test.mjs

- fleet feed reuses sessions, rejects cross-room events, and keeps credentials out of published snapshots
- one revoked background server does not revoke another, and a changed credential starts a new session
- subscription limit counts the selected socket and ignores a late grant after unsubscription
- shared node totals use one fresh Host sample, separate nodes stay separate, stale and Paper data stay unavailable
- cards distinguish service one-core CPU from node CPU and do not fabricate stale or missing metrics
- Host replacement clears old metrics and ignores delayed old-session events
- fleet rendering exposes selected-server navigation and unavailable metrics without credentials
- mixed-version fleet hides service/node totals and blocks Host controls
- selector remembers labels while connections are unavailable and distinguishes them from browser device names
- a relay socket that never supplies an authenticated ready cannot remain connecting indefinitely

## metric-reports.test.mjs

- 250ms Host updates cannot manufacture Paper samples or inflate observed p95
- actual source gaps break paths, future clocks are rejected and null is never a zero
- window coverage does not bridge missing captures and labels nearest-rank p95 as sampled
- systemd CPU stays above 100% with explicit one-core units in scoped exports
- service history only accepts authenticated Host cgroup resources; no wire change
- default five-second Paper JVM captures form continuous observed coverage

## player-activity-placement.test.mjs

- recent player activity is presented by the Players workspace
- Overview uses a brief observed activity summary without hidden legacy cards
- the 3.x Activity modal queries Paper and suppresses the duplicate History tab

## preflight-scope-parity.test.mjs

- backup.preflight is authorized by the canonical backup.view contract
- browser and relay scope modules are generated from one checked-in manifest

## rendered-html.test.mjs

- renders the PlexonPanel dashboard shell
- does not expose the removed server-side session API

## telemetry-freshness.test.mjs

- sample freshness rejects missing, expired, future and disconnected samples consistently
- fresh Host traffic cannot label missing Minecraft samples as live or fabricate server metrics
- old captures stay stale after replay and switching instances cannot reuse another server's freshness
- ready waits for the first current-session sample once, without extending the outage on repeated ready packets
- older captures cannot replace current telemetry or service state; role and session boundaries remain enforced
- packet receipts prevent timer/skew flicker, one clock serves all indicators, and foregrounding reveals real loss

## ui-preferences.test.mjs

- UI preferences use provider-aware safe defaults
- strict parsing drops unknown and corrupt preference values
- invalid display update rates migrate to the balanced default
- oversized or invalid stored JSON falls back safely
- legacy density and chart window migrate without touching other keys
- saved schema mirrors temporary legacy compatibility keys
- system resolution honors reduced motion as a safety floor

## views.test.mjs

- read-only console and chat omit execution controls
- host and file routes show explicit unavailable states without privileged controls
- uploaded-looking log content and plugin names remain escaped text
- 3.0 activity history opens in place instead of navigating away
- Players distinguishes missing scope, local policy and older agents
- offline history detail is read-only and exposes no player actions

