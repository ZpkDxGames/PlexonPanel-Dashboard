# PlexonPanel Next Generation — Strata design specification

Version 1.0 · 2026-10-16 · implementation target: separate frontend feature branch.

**Decision:** build **Strata**, a full-width Minecraft operations workspace with architectural layers, an evidence-led instrument surface and deliberately different compositions for monitoring, community, terminal, recovery and access tasks. Keep the current product contract. This is a product-level presentation rebuild, not an additional theme for Control Room.

## Contents

1. Evidence, concepts and selection
2. Information architecture and responsive frame
3. Tokens, typography, assets and components
4. State and interaction contracts
5. Eight route specifications
6. Pairing, review and source inspection
7. Chart and motion systems
8. Preference mapping and originality acceptance

## 1. Evidence, concepts and selection

### 1.1 Baseline distinction

The pinned source is Control Room, PR #90 merge `4357a66`. It already has a grouped sidebar, source-aware charts, an in-page player profile, real plugin inventory, manual Host backup workflows and light/dark themes. The audit is in `SOURCE_AUDIT.md`; current baseline captures are under `evidence/baseline/`. Those images are development fixtures, not production readings.

The existing build passed 61 tests, build, its 89, 808-byte initial-JS gate and 32 main route screenshots with no automated axe/overflow/page-error failures during this planning run. Visual differences below are mostly task-hierarchy improvements; do not describe the existing UI as universally broken or inaccessible.

| Evidence ID | Current / source | Finding and classification | Concrete response | Acceptance |
| --- | --- | --- | --- | --- |
| D01 | `Shell.tsx` sidebar + masthead + workspace heading; `styles.css` sidebar at 240px | RENDERED: repeated route/server context and sidebar consume horizontal room | Two-level horizontal desktop header; one entity heading and integrated source ribbon | All eight labels visible at 1440; usable instrument and terminal fit side by side |
| D02 | `Overview.tsx` `overview-grid`; baseline Overview | RENDERED: server facts precede the main usage plot; mobile scroll reaches technical facts before the main instrument | Move instrument and console into first task row; identity detail becomes lower disclosure | Main chart and six console lines visible by 900px desktop height |
| D03 | `Backups.tsx` `backup-workspace`; mobile baseline | RENDERED: degraded job/retry evidence appears after create/preflight/archive content | Put current job and recovery reason first; create is a deliberate secondary block while a problem exists | Degraded reason + local/remote proof visible within first mobile viewport |
| D04 | `Backups.tsx` five-gate list; `backup-readiness.ts`; Host preflight handler | SOURCE: provider and source/capacity facts exist but route presents only five coarse gates | Expand safe preflight evidence with independently known provider/storage/source fields | Provider failure does not mark later storage/source checks failed without evidence |
| D05 | `Console.tsx` fixed `height=480`, `lineHeight=28`; baseline mobile Console | SOURCE + RENDERED: fixed terminal region places composer far down; row/font coupling needs testing | Height derived from available viewport, sticky-in-surface composer; measured row geometry | At 390×844 terminal controls and composer reachable without page-sized empty scrolling |
| D06 | `Players.tsx` local `selected` and `inspecting` | SOURCE: nested detail exists without a profile URL; roster is retained hidden | Preserve this model, sharpen profile identity and tool grouping; do not promise deep links | Back restores row focus/filter/scroll, vanished UUID never retargets |
| D07 | `PlayerHead.tsx` `failed`/`loaded` state | SOURCE risk: failed provider state is not reset on changed provider/UUID | Key/reset image state by provider+UUID and reserve fallback space | Fail one provider, change provider, verify one authorized new request and correct fallback |
| D08 | `Access.tsx` `scope-view` | SOURCE: effective scopes shown as chips; capability reasons require inference | Searchable read-only authority ledger with grant/capability/reason per supported UI action | Owner with missing scope remains visibly unavailable |
| D09 | `Settings.tsx` preferenceSaved; preferences update catches storage errors | SOURCE risk: “saved” feedback can overstate durable persistence in restricted storage | Use “Applied in this browser” unless persistence is confirmed; preserve optional store behavior | Storage denial still permits in-memory changes; fresh reload test remains |
| D10 | Current `TimeSeries` and historical replay report | DOCUMENTED: optional eight-track comparison has high tail cost; not independently reprofiled in planning | Keep focused default; isolate pointer inspection; measure comparison explicitly | QA budgets and baseline/candidate paired replay pass |
| D11 | All routes at 32 main screenshots | HYPOTHESIS: 320px, real zoom, full preference combinations and physical touch may reveal other issues | Required width/preference/state matrix; no presumption of failure or pass | Evidence row per executed/blocked scenario |
| D12 | `App.tsx` route key; source epochs | SOURCE: view identity includes both agent sessions and selection revision | Preserve reset boundaries; avoid cosmetic remounts on each sample | Crosshair/inputs stable through telemetry updates; new authority invalidates old work |

### 1.2 Three coherent concepts

| Concept | Composition / interaction | Visual identity | Strength | Tradeoff / selection |
| --- | --- | --- | --- | --- |
| **A — Strata** | Horizontal full-route navigation; broad instrument/terminal split; connected ledgers; source evidence beside each task | Basalt and limestone, deep teal actions, precise thin rules, small original block-cut emblems, humanist headings with monospaced measurements | Makes server/service/node scope legible; gives every route a distinctive work surface; both themes natural | Requires intentional navigation and CSS migration. **Selected** |
| **B — Lantern** | 208px community rail; player portrait/session master-detail; softer 3:2 task panels; guided backup wizard | Warm porcelain/charcoal, muted apricot highlights, generous rounded imagery and editorial typography | Approachable community management and onboarding | Portrait emphasis and wide cards compete with console/telemetry density; wizard hides simultaneous evidence. Do not mix its rounded card language into Strata |
| **C — Vector** | 64px icon command spine, second contextual rail, compact stacked instruments; keyboard-centric route/command workbench | Near-black/white, cobalt signal, squared frames, strongly monospaced hierarchy, minimal decoration | Fast intensive expert use; efficient terminal | Icon rail and dual context require more learning and mobile translation; too utilitarian for desired balanced character |

See `design/concepts.png` for a planning comparison. Selection criteria (1–5, design judgment, not measured usability):

| Concept | Task clarity | Original identity | Dark/light balance | Narrow-screen adaptation | Performance feasibility | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Strata | 5 | 5 | 5 | 4 | 5 | 24 |
| Lantern | 4 | 4 | 5 | 4 | 4 | 21 |
| Vector | 5 | 4 | 4 | 3 | 5 | 21 |

### 1.3 Reference board and limits

Use primary references as reasoning examples, not a screenshot to copy:

- [W3C reflow](https://www.w3.org/WAI/WCAG 22/Understanding/reflow.html): retain usable content at narrow effective width; allow intentional two-dimensional data regions without page overflow.
- [W3C target size](https://www.w3.org/WAI/WCAG 22/Understanding/target-size-minimum.html): check target spacing and size. This product chooses 44px touch targets, stricter than the AA minimum in many cases.
- [W3C contrast](https://www.w3.org/WAI/WCAG 22/Understanding/contrast-minimum.html): verify text contrast, including secondary labels in light theme.
- [Grafana time-series documentation](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/time-series/): a useful comparison for explicit null-gap treatment and data inspection. Keep PlexonPanel's own geometry and source model.

Originality comes from the server/service/node layer grammar, full-width route frame, block-cut identities and task-specific compositions. Do not import another product's panel proportions, logo, icon silhouettes, screenshot palette or CSS. References retrieved 2026-10-16. Motion timing below is a product decision, not a claim of compliance with a third-party motion system.

## 2. Information architecture and responsive frame

### 2.1 Preserve navigation identifiers

| Existing hash | Visible label | Primary question |
| --- | --- | --- |
| `#Fleet` | Fleet | Which paired instance am I about to select? |
| `#Overview` | Overview | What is this server doing now? |
| `#Performance` | Performance | What did this source actually observe? |
| `#Players` | Players | Who is here, and what can I do for this exact player? |
| `#Console` | Console & chat | What did the server report, and which Paper command/message can I review? |
| `#Backups` | Backups | Is a job running, what is verified, and can I safely prepare another? |
| `#Access` | Access & audit | What can this browser do, and what did each agent record? |
| `#Settings` | Settings | How does this browser display and connect? |

Keep eight routes and lazy imports. Console has Console / Live chat / Plugin inventory tabs; Access has Operation trail / Paired devices / Your authority. Players detail is an in-page nested view with Back, not a new ninth route. Keep `#Settings?section=appearance|connection|privacy|diagnostics` working. No Files/Plugins top-level route or unused navigation slots.

### 2.2 Layout primitives

At 1440×900, use a 64px masthead, 48px route band and 24px gap before a 48–72px title/target row. Content maximum is 1600px, with 32px outer gutters at ≥1280, 24px at 820–1279, 20px at 640–819 and 16px below 640. At 1920, center the 1600px content; background bands can be full width. No CSS zoom or transform scaling.

Desktop masthead: 160px brand; selected-server switcher flexing 240–360px; transport status; flexible spacer; Quick find; theme control; browser identity. A long name wraps to at most two lines in the selector; full name/ID remains in its dialog and review. Route band contains all eight text labels, grouped subtly by spacing after Fleet and before Access; do not split ownership into misleading global/server permission zones. On Fleet/Settings still show selected target, but do not imply those local pages can operate all servers.

Below 1280, replace the route band with a labeled Workspace button and current route in the masthead, opening the existing native navigation dialog. Never display an unlabeled icon-only rail. At 820–1279, use two header lines when target/controls need room. Below 640, first line is Workspace + brand + search, second line selected server + source summary; theme is also available in Settings. Header can grow to 104px at standard text, with no fixed text clipping. Only the compact masthead is sticky. Route tabs and explanatory headings scroll away. At 200% zoom all narrow rules apply naturally.

Main grid: 12 columns with 20px gutters ≥1280; 8 columns with 16px gutters at 820–1279; 4 columns with 16px gutters at 640–819; one column with 16px gaps below 640. Within a work surface, use 16/20/24px padding based on density. All min-width constraints must allow `min-width:0`; long values wrap. Source ribbon at most four detail chips plus transport; mobile uses a two-column source grid or a summary button with the complete accessible disclosure. A red whole-page banner appears only for a blocking connection/action error, not every stale reading.

## 3. Visual system

### 3.1 Semantic color tokens

These are initial locked token values. Implement the same values unless measured contrast requires a documented correction; do not improvise route-specific colors. Solid surfaces; no backdrop blur, noisy gradients or glow.

| Token | Dark | Light | Usage |
| --- | --- | --- | --- |
| `--canvas` | `#101718` | `#F3F4EF` | App background |
| `--surface` | `#182224` | `#FFFFFF` | Main work sheet |
| `--surface-raised` | `#233033` | `#E9EEEA` | Hover, selected controls, disclosures |
| `--surface-inset` | `#0D1416` | `#F7F9F6` | Plot/terminal region |
| `--text` | `#ECF3EE` | `#172526` | Primary |
| `--text-secondary` | `#B4C5BF` | `#465D57` | Metadata, evidence, placeholders |
| `--text-muted` | `#95AAA3` | `#526761` | Tertiary, never less contrast for important information |
| `--border` | `#354A46` | `#CAD5CF` | Decorative dividers |
| `--control-border` | `#75938A` | `#657D74` | Input/focus-adjacent required boundaries |
| `--action` | `#78DCC4` | `#116D5E` | Primary action fill |
| `--on-action` | `#10241E` | `#FFFFFF` | Button text |
| `--focus` | `#A3F0DC` | `#075D50` | 2px outer ring, 2px offset |
| `--success` | `#88DBAB` | `#14653D` | Confirmed success only |
| `--warning` | `#F0C775` | `#805000` | Delayed/degraded/attention |
| `--danger` | `#FFB0A8` | `#A92D25` | Failure/destructive action |
| `--info` | `#9DCBFF` | `#285F9D` | Routing, pending information |

Status foregrounds sit on neutral surfaces or 8% tinted semantic surfaces with explicit labels and glyphs. Never use pastel text on light backgrounds. Hover changes a surface, not numerical values. Disabled controls retain legible text and a visible explanation; opacity never hides essential meaning.

| Persisted accent | Dark signal | Light signal | Label |
| --- | --- | --- | --- |
| `teal` | `#78DCC4` | `#116D5E` | Teal |
| `blue` | `#9DCBFF` | `#285F9D` | Blue |
| `violet` | `#C4B7FF` | `#6651A6` | Violet |

Accent changes selected indicators and primary plot signal; semantic status stays stable. Primary action stays teal for consistent affordance. Secondary chart signals use violet, blue and warning hues with line labels/patterns; never require color alone to identify a track. Do not remap stored enum values.

### 3.2 Type, geometry and spacing

Keep self-hosted Manrope Variable (body, headings, controls) and JetBrains Mono (readings, time, UUID, terminal). No additional network font. Use tabular numerals and reserve widths for changing numbers.

| Role | Standard size/line-height | Weight | Rule |
| --- | --- | --- | --- |
| Route heading | 28/36px desktop; 24/32px mobile | 650 | One H1 per route |
| Entity/profile name | 24/32px | 650 | No uppercase names |
| Work-surface heading | 18/26px | 650 | Clear task label |
| Main reading | 32/40px | 550 mono | Unit 14/20, baseline aligned |
| Body/control | 15/22px | 450/600 | Never downscale body to fit |
| Table / evidence | 14/20px | 450 | Important source labels ≥14 standard |
| Eyebrow | 12/18px | 650 | Occasional short category, not every field |
| Terminal | 13/22px mono | 400 | User text-size preference scales it |

Implement in rem; preserve root small/standard/large = 14/16/18px. Route and reading sizes derive from rem and responsive limits. At small size, interactive content remains readable; at large, wrap rather than ellipsize task labels. Density affects padding and rows, not font size. Spacing scale 4/8/12/16/20/24/32/40/48px. Surface radii 12px, controls 8px, tiny status tags 5px, profile emblems 10px. Avoid pills except short status badges. Borders 1px; no decorative double outlines. Elevation: menus/dialogs only, dark shadow `0 12px 36px #00000040`, light `0 12px 36px #16382B18`.

Comfortable controls 40px, compact desktop 36px, spacious 44px; all coarse-pointer controls at least 44px regardless of density. Desktop ledger rows 56/64/72px compact/comfortable/spacious. Mobile rows expand to content, minimum 72px. Dialog footer targets ≥44px in all modes.

### 3.3 Icon and asset direction

Extend `Icon.tsx`, not an external icon library. 20×20 viewbox, 1.75px rounded strokes, 2px internal padding, currentColor, no mixed visual families. Icons: stepped four-block server, layered node, tick trace, paired heads, prompt cursor, stacked archive, key/ledger, tuning sliders. Unknown state uses dash/circle, denied uses lock, disconnected uses broken link, stale uses clock, failed uses x, verified uses check.

Create a simple original **three-layer block-cut emblem** for brand/server fallback: three offset rectangular planes, no Minecraft grass texture or copied game logo. It represents software layers, not measured infrastructure topology. Use an 8px construction grid; 24px brand mark and 40–64px entity stamp. Keep source SVG under 3KB each. World glyphs are generic stacked terrain slices until real environment/type is explicitly reported; never infer Nether/End from a custom world name. No illustration larger than 120px in an operational route. Pairing may use one static 240px layer diagram beside the form, labeled as a connection explanation.

Player identity stays actual provider head when permitted, local initials otherwise; 32px roster, 80px profile. Do not generate a player's skin, invent a full-body appearance or add WebGL. Decorative assets are aria-hidden; accessible adjacent text describes real identity. Combined new local vector assets ≤24KB gzip.

### 3.4 Component inventory and ownership

New named components are implementation contracts, not pre-existing files:

| Component / proposed path in `src/components/nextgen/` | Responsibilities | Must not own |
| --- | --- | --- |
| `WorkspaceHeader.tsx` | Route/entity title, primary actions, target IDs | Session selection or authority logic |
| `SourceRibbon.tsx` | Four independent source states and disclosure entry | New polling or freshness thresholds |
| `EvidenceValue.tsx` | Value/unit/source/state; last-observed label | Mutating/defaulting raw data |
| `WorkSurface.tsx` | Header/body/footer grid and semantic section | Generic nested card wrappers |
| `StateBlock.tsx` | State, reason, one supported next step | Reconnect/mutation side effects on mount |
| `ActionAvailability.tsx` | Visible non-executable reason from source gate | A replacement permission gate |
| `EvidenceDisclosure.tsx` | Capture, receipt, cadence, IDs, source bounds | Secrets or inferred source freshness |
| `RecordList.tsx` | Shared ledger/table responsive styling | Generic table framework or data fetching |
| `CopyValue.tsx` | Explicit copy, success/failure feedback, full value | Automatic clipboard reads |

Retain existing `Modal`, `Button`, `Notice`, `Status`, `Panel` compatibility during staged migration; replace usages intentionally. Keep `ActionReview` as the single reviewed-dispatch surface. Do not create a second dispatch modal for each route.

## 4. State contracts

### 4.1 Shared states

| Code | State | Presentation | Allowed next step |
| --- | --- | --- | --- |
| S01 | Initial/loading | Static skeleton in final geometry, status “Reading …”; no invented numbers | Wait; safe navigation remains available |
| S02 | Fresh known value / true zero | Normal reading and source label; zero rendered numerically | Inspect sample or supported action |
| S03 | Delayed | Amber clock + age; retain actual value | Inspect receipt/capture; no automatic reconnect |
| S04 | Stale | “Last observed …”, age; historical graph remains with stale label; current meters suppressed | Read-only inspection, explicit refresh where query exists |
| S05 | Waiting/missing/unknown | Em dash with exact missing field/source reason | Wait or inspect connection; never show zero |
| S06 | Disconnected/offline | Explicit relay/Paper/Host name; last retained data marked historical | Explicit reconnect for transport; no false service-state inference |
| S07 | Denied | Lock + missing scope or source gate reason; protected content withheld | Inspect Access; no automatic pairing or elevation |
| S08 | Capability unavailable | “Not enabled by [agent]” where supported; distinguish contract mismatch | Read explanation; no config/credential form |
| S09 | Empty success / no match | Verified empty list or local filter-empty message with clear filters | Supported query refresh / clear filter |
| S10 | Busy / pending | Disable duplicate action; stable context and actual phase | Inspect current status; no queued destructive resend |
| S11 | Failure / degraded | Code and safe message; retain independent successful evidence | Explicit supported read-only refresh or reviewed retry-upload |
| S12 | Unknown outcome / recovery | Amber/red by actual state; exact request/job/target; no success icon | Audit/status verification; operator recovery procedure |
| S13 | Clock skew | Clock icon and receipt age, actual capture shown | Inspect two clocks; preserve classifier behavior |
| S14 | Agent success / job accepted | Result code and operation-specific meaning | Close/read status; no assumption all downstream work completed |

States compose: denied takes precedence over revealing data; relay state does not replace independent source state; job recovery may coexist with a verified local archive. Never make a single green “Online” badge summarize unrelated authorities. Skeleton is for an outstanding read, not a permanent denial. Reserve error-message space where short errors are expected; allow longer messages to expand.

## 5. Route specifications

All eight routes are mandatory. Each inherits the shared state table and has its own concrete exceptions below. Coordinates are CSS-pixel composition targets at standard text/comfortable density, not fixed heights when content needs reflow. Planning plates under `design/` are static wireframes, not browser screenshots or implemented UI; the text and source contract govern details.

### R01 — Fleet: an instance ledger with verified infrastructure

**Purpose and data.** Show paired instances, the sole selected action target and trustworthy node context. Reuse `Fleet.tsx`, `session.select`, `sourceEvidence`, `verifiedNodes`, `Sparkline` and fleet feed bounds. Server IDs and node IDs remain identity; server names are presentation labels. The ledger must scale from one to sixteen sessions without sixteen large empty cards.

**Desktop.** Title row “Fleet”, paired count, Pair another server at right. Search occupies a 360px field with result count beside it. Main surface spans 8 columns; a 4-column verified-node register aligns at the top. Each instance row is 96px comfortable: 40px original block stamp, two-line name/instance key, Paper TPS and players, independent Paper/Host badges, small exact-history sparkline and Select/Enter button. Selected row has a 3px inner leading accent and text “Selected action target”; no lifecycle controls on passive rows. The node register displays one card-like row per verified node: ID disclosure, known member count and actual node CPU/memory with source capture. If membership is not fully observable, say “N observed instances”, not total installed servers. Never sum cgroup CPU/memory as node usage.

**Tablet.** At 820–1279 the ledger occupies 8 columns; node register follows in a two-column grid. Instance rows become two lines: identity/action first, signal/source evidence second. At 640–819 use two instances per row only if each has ≥296px; otherwise ledger rows remain full width. All identifiers are available by disclosure/copy; no horizontal document scroll.

**Mobile.** Each instance is a 2-row full-width record with name + selected badge, then TPS/players and source labels; Select is a 44px-wide minimum action at the bottom. Sparkline is supplementary and may be omitted below 360px without removing numeric/source evidence. Verified-node register follows the ledger. Pair another server stays near the heading, opening the existing Connections section.

**Interaction and states.** Search is local by name/ID/key. Selecting disables just the selected request, announces target change and opens Overview only after selection resolves. A failed selection leaves the old target explicit and preserves its authority. S01 loading records; S03/04 badges qualify last observations; S06 agent offline never means service stopped; S07 grant loss hides unauthorized values; S09 no match has Clear search. Zero pairings normally reach PairingGate; if Fleet renders empty during a transition, show one empty block, not both existing empty branches. Legacy/unbound node identity receives no node aggregation and remains selectable only under the existing compatibility gate.

**Acceptance.** `R01-D`: 1440×900, sixteen mixed-state fixture instances, first five rows and verified-node register readable; selected target unmistakable. `R01-M`: 390×844, two long-name records show action/source labels without clipping. Repeated node ID appears once; passive sparkline never borrows selected history. Test denied/passive/legacy/selection-error scenarios and verify no cross-instance mutation button exists. Files: Fleet route, Telemetry and route CSS; fleet adapters unchanged.

### R02 — Overview: the operational desk without a banner

**Purpose and data.** Answer server state, current load and recent evidence in one glance. Reuse exact fields in `Overview.tsx`, ConsolePreview and existing source projections. Keep start/restart/stop prepared through Host. Remove decorative hero/banner and repeated Minecraft title block; facts become a compact source/identity disclosure.

**Desktop.** At 1440: title/target row approximately y136–200 with server name, service state and reviewed lifecycle buttons. Source ribbon sits immediately beneath. A single divided four-cell measurement strip (~100px) follows: TPS, mean MSPT, online/capacity and JVM heap, each with its own source state; observed peak is labeled retained-session evidence. Main row is 7 columns instrument + 5 columns console, both ~360–400px tall. Instrument defaults TPS with existing TPS/service CPU/heap selector and 1/5/15/30-minute windows, summary, actual sample inspection and View data. Console shows six to eight actual lines, authority, pause, and Open console. Below: 4-column infrastructure layers (Paper JVM, Minecraft cgroup, Host node), 4-column world ledger and 4-column player preview. Tick-health details are a full-width lower section with mean-MSPT chart, 50ms reference, coverage and retained exceedance count. Keep all existing facts and navigation reachable.

**Tablet.** Eight-column grid: metrics 4×2 columns; instrument 8 columns; console and infrastructure each 4 columns; worlds and players each 4. At 820 the plot precedes console. No permanent left information rail. Lifecycle controls remain explicit buttons that wrap to a separate row, with unavailable reason immediately adjacent.

**Mobile.** Entity and lifecycle block; two-by-two reading strip; instrument; console preview; infrastructure; players; worlds; tick-health disclosure. Main plot height 240–280px; ticks simplify without losing units. Do not put server UUID/version facts ahead of the instrument. UUID/version detail is in “Instance details”. At 320, lifecycle buttons stack where necessary; no swipe-only access.

**Interaction and states.** Metric/range selection changes only the display window, never retention/cadence. Active player preview opens Players (preserve existing behavior; no invented detail URL). Resource layers label actual scope; meters disappear for unusable/unknown capacity. S01 stable metric/plot/console placeholders; S04 numerical last observations retain stale text; S06 Host-only stopped-server state keeps journal and Host status visible; S07 roster/console denial replaces only those modules. Unknown service state prevents false start/stop affordance. Every lifecycle button invokes one shared review and remains server/session-bound. No predictive “healthy score” or AI diagnosis.

**Acceptance.** `R02-D`: 1440×900 dark/light, route/entity, four readings, complete primary plot and six console lines visible without scrolling; no large banner. `R02-M`: 390×844, selected server and main readings readable and plot begins within first viewport. Show 150% service CPU without clamping, zero players as 0, stale heap without meter, and offline Paper with live Host. Compare source clocks and raw sample table to baseline. Files: Overview, ConsolePreview, Telemetry, shared evidence primitives, route CSS.

### R03 — Performance: one precise instrument, optional comparison

**Purpose and data.** Inspect eight real signals: TPS, mean MSPT, service CPU, Paper process CPU, node CPU, heap, service memory and node memory. Preserve GC cumulative-pause movement and tick-budget coverage observations. The plot is the main work surface; numeric “scores” and fabricated percentile panels are excluded.

**Desktop.** Header contains 1/5/15/30-minute window and Compare all signals. Main surface spans 12 columns: a 216px signal catalog grouped Runtime/Compute/Memory and a flexible instrument stage. Catalog labels include source; no live mini-chart per catalog entry. Instrument stage has title/unit/source badge, four compact observed summary values (mean/min/max/count), 360px plot, a fixed-height inspection shelf (~72px) and expandable source/data evidence. Tick-budget and GC registers sit in a 7:5 row beneath. Comparison replaces the focus stage with eight labeled 190px tracks; keep one track per row below 1800px, two only at ≥1800 with independent axes. All eight remain available on every viewport.

**Tablet.** Catalog becomes three grouped rows of controls above the plot at ≥820; focus stage full width. At 640–819 use the existing native grouped signal select with title and source directly below. Plot height 300px. Summary becomes two-by-two, retaining full units. The optional comparison is a single vertical sequence.

**Mobile.** Native signal select, range buttons, comparison toggle, then title/current source and two-by-two summaries. Plot height 260px with 48px axis allowance or measured maximum label width. Inspect-by-touch pins a sample; Previous/Next and Clear pin remain 44px controls below the plot. Data table is a labeled internal scroll region with original observation timestamps and explicit bounded count. No hover-only evidence.

**Interaction and states.** Pointer move updates crosshair at most once per frame; arrow/Home/End use actual observations; Escape clears pin. Streaming data must not move a pinned timestamp to a new sample index. If it ages out, show “Pinned sample left retained window”, clear only after announcing. Preserve gap/null/extrema rules. S05 one sample is a point, no samples an explicit empty plot; S04 retains historical curve but stale status; S13 displays capture/receipt mismatch; S07 unavailable telemetry gives a scope state rather than eight zero graphs. Compare tracks use common inspection time but independently labeled actual timestamps; no invented synchronized captures. Service CPU auto-ranges above 100%; TPS 20 and MSPT 50 references do not clip outliers.

**Acceptance.** `R03-D`: 1440×900 selected signal, axes, summaries and inspection shelf legible with one null gap and spike. `R03-M`: 390×844 touch-pinned sample, exact time and Previous/Next controls visible; table does not widen document. Compare all eight at 8192 points, clock skew, source reconnect, missing denominator and OS reduced motion. Performance gates apply equally to interactive and idle rendering. Files: Performance, TimeSeries, route CSS; protected projections only by separately justified correction.

### R04 — Players: a community roster and exact-identity profile

**Purpose and data.** Keep live roster search/name-or-UUID, world filter, name/ping/session sorting, heads, UUID copy, current session, every existing player action and exact-UUID retained history. No inventory, ender chest, player notes, economy, location panel or lifetime statistics is added.

**Desktop.** Roster heading shows reported player count and source state, followed by search + world + sort toolbar. Full-width ledger has Player (head, name, secondary UUID), World, Current session, Ping and Inspect; rows 64px comfortable. No giant empty player cards. Entering detail replaces the roster work area with Back to players, an 80px head, name/UUID/copy, world/current session/ping/source strip. Below, 7-column tools + 5-column history. Interact contains message, game mode and supportive Heal/Feed controls. Moderate contains whitelist add/remove, kick/ban with reason, kill and OP/de-OP in an explicitly sensitive subregion. Commands contains the existing player/UUID template and LuckPerms set/unset builder with exact preview; no assumption LuckPerms is installed or permitted. Moving Heal/Feed is presentational; all action names/parameters remain unchanged.

**Tablet.** Roster retains name/world/ping on the first line and session/UUID below; inspect target is the whole named row without nested buttons. Profile header wraps, then tools and history each full width at <1024. Tool tabs remain visible and keyboard navigable, not in a hidden overflow menu. Long command output is wrapped selectable code with copy only on explicit click.

**Mobile.** Two-line roster record: head/name/world, then ping/session and Inspect label. Profile: Back, head/name, UUID/copy on its own wrapping line; three facts in stacked label/value rows; tool tabs; chosen tool form; Session history. Use grouped normal buttons instead of nine equally prominent danger buttons. History entries use event glyph + observed time + actual termination/duration. Latest/Older uses the existing 25-entry page and opaque cursor, replacing rather than infinitely accumulating pages.

**Interaction and states.** Keep roster scroll/filter and restore focus to inspected row on Back, falling back to heading if removed. S07 no roster scope reveals no names. S04 stale roster is labeled observed; action availability remains source-gated, not inferred from freshness badge alone. If selected UUID disappears, show the exact absent identity and disable tools; do not silently select another player. S08 history-disabled differs from scope denial; S09 no retained observations differs from no online players and no filter match. Late history for player A cannot enter B or another server. Skin-disabled/failure uses fixed local fallback without extra providers. Every mutation uses Paper review; role name alone cannot grant OP.

**Acceptance.** `R04-D`: roster and full profile each 1440×900 dark/light; tools/history balanced and sensitive actions visually separated. `R04-M`: 390×844 profile has readable full UUID and a reachable selected tool without portrait dominating. Test every action family, history cursor/disabled/empty/error/late-response, provider failure/change, vanished player, permission loss and Back focus. Files: Players, PlayerHead, PlayerHistory, route CSS; player command helpers preserved.

### R05 — Console & chat: a working terminal with complementary tabs

**Purpose and data.** Preserve console stream/history, source/level/text filtering, pause, tail, wrap, clear/undo, export, time zone, Paper commands, safe formatting, chat, MiniMessage gate and plugin inventory/reload. Keep Plugin inventory as the third Console tab; do not add a redundant top-level Plugins destination or remove a real capability based on older feedback.

**Desktop.** Tab strip above one terminal surface, not a second navigation sidebar. Console header shows Host journal / Paper fallback / Unavailable, transport/source state and retained count. One 48px filter row contains text, level, source; adjacent controls Pause, Wrap, Export and Clear view. Terminal is the flexible center, minimum 280px and target 420–520px depending viewport. Fixed surface footer shows follow state, matches/retained, displayed bound and clock. Composer is a distinct final row with Paper label, single-line normalized command textarea and Review. It stays visible inside the terminal work area; no fake OS window chrome. Chat tab: 8-column stream + 4-column composer/preview. Plugin inventory: name/version/status ledger and a per-row Review reload action.

**Tablet.** Filters take two rows; terminal source/status stays above output. Chat becomes 5:3 columns at ≥1024, single column below. Plugin names wrap before actions, preserving actual version and enabled/disabled/unknown. Console height uses container/viewport measurement; do not retain hard-coded JS height inconsistent with CSS.

**Mobile.** Tabs occupy three equal buttons with short visible labels Console / Chat / Plugins, accessible full labels. Search first; Filters disclosure holds level/source and utility actions; Pause and Return to live remain visible. Terminal usable height at least 240px when keyboard closed, with timestamp/source/severity compactly grouped; horizontal scroll stays inside output in nowrap mode. Composer remains in flow/sticky within the surface, never obscuring keyboard focus; with virtual keyboard reduce terminal height rather than cover input. Chat composer follows stream with a jump-to-compose control; avoid forcing a huge permanent chat history above it.

**Interaction and states.** Scrolling up stops tail-follow without stopping ingestion; show “Inspecting retained output”, not “Live tail”. Explicit Return to live restores bottom. Pausing freezes display only, clearing view is local and undoable; export uses currently filtered authorized lines. Preserve 2500 raw lines and wrap latest-400 disclosure. S07 denied console is not “quiet”; errors-only scope cannot reveal INFO through filtering/export. S06 Paper offline can retain Host journal while command review is unavailable. S08 MiniMessage disabled carries a reason and sends false; safe preview is not HTML. Plugin reload stays exact name and configured Paper command policy; no generic `/reload` fallback. S12 unknown command outcome opens audit/status guidance, no resend.

**Acceptance.** `R05-D`: 1440×900 output and composer visible, at least 12 actual terminal rows, unambiguous authority. `R05-M`: 390×844 nowrap/wrap, filters expanded, keyboard and long output; no document overflow or input obstruction. Capture Chat and Plugins dark/light at both sizes. Verify filtered export, pause/ingestion, clear/undo, errors-only, malicious formatting and plugin policy denial. Files: Console, FormattedText styling only, route CSS; parser/command dispatch unchanged.

### R06 — Backups: verified evidence and durable recovery first

**Purpose and data.** Preserve manual full backup, exact warning choices, preflight/list/status, reviewed verify/delete/retry-upload, job phases and local/remote proof. Host remains available independently of Paper. Do not create scheduled backups, browser restores, download manager, provider login or recovery-clear buttons.

**Desktop.** Header “Backups” with Refresh evidence, no hero. First row is 8-column current/latest job surface + 4-column manual-create panel. Job surface has job ID, actual phase, last status receipt, safe error, local verification, remote verification and restart-recovery status if reported. Visual workflow has five semantic groups: Prepare, Stop, Archive, Off-site, Return online. Each expands to the existing exact phase names, with only reported current phase highlighted. Earlier positions are neutral unless individually proven by a returned flag; no fake completion ticks. Create panel has 30/15/10/5 selector, stop/restart consequence text and Review new backup, with readiness reason. Second row is full-width preflight evidence; third is archive ledger + optional selected archive detail. Archive availability and verification are separate columns/fields.

**Tablet.** Current job spans 8 columns, then create 3 and preflight 5; inventory spans 8. At <1024, create and preflight stack. Status/verification have priority over long inventory. All job IDs and safe errors wrap; no red/green flood across the phase sequence.

**Mobile.** First viewport: phase/error, local/remote proof, last status age and reviewed upload retry if truly retryable. Preflight and create follow. Inventory becomes record cards showing filename/ID, date/size, local/off-site availability and Verify/Delete; no mandatory horizontal swipe to reach a destructive target. A supplemental table can remain available on desktop only with equivalent content. Workflow details are collapsed by default under a “Phase details” disclosure; active phase stays visible.

**Interaction and states.** On mount refresh existing authorized reads; status polling remains 3s only while active/live/visible, not a new global poller. Match progress `jobId`; separate reported bytes/rate from durable verification. Successful create returns a job receipt, not “backup complete”. Unknown/expired (>30s) preflight disables create. Show safe existing provider/sourceBytes/entryCount/usableBytes/requiredBytes fields only when returned. A failed early preflight leaves untested later checks unknown. If structured error details are absent in the current query abstraction, show code/message and unknown rows; do not silently edit adapter error semantics. Paper offline alone does not disable Host workflow. S11 degraded retains local verification and existing archive; retry-upload only if `retryable===true`, exact backupId and scope permit it. S12 recovery shows operator procedure boundary, no browser reset. Status age and inventory refresh time remain independently labeled; no infinite spinner on denied reads.

**Acceptance.** `R06-D`: 1440×900 current job/create/preflight visible and first archive rows begin; ready and degraded screens separate. `R06-M`: 390×844 degraded reason, proof and retry visible without scrolling past inventory. Capture QUEUED/COUNTDOWN/ARCHIVING/UPLOADING/VERIFYING_REMOTE/COMPLETED/DEGRADED/FAILED/RECOVERY_REQUIRED, unavailable provider, expired preflight, mismatched job progress, partial query failures and remote-only archive. Verify no progress percentage implies completion. Files: Backups, ActionReview presentation, route CSS; helpers reused read-only, backend untouched.

### R07 — Access & audit: understand authority before exercising it

**Purpose and data.** Preserve source-selectable audit (`audit.list` or `audit.self`), filter, devices, protected current browser, exact revoke and effective scopes. Do not turn role/scopes into editable switches. Do not imply a Host mirror is Paper authority.

**Desktop.** Title row shows current device name and selected server. Three tabs: Operation trail / Paired devices / Your authority. Operation trail is a full-width ledger with filter, explicit Host/Paper selector, Refresh and scope label “This device” or “Authorized audit”. Columns: Recorded, Actor, Operation, Target, Outcome. Row expansion reveals only existing safe details and exact IDs; no fabricated trace or request chain. Paired devices uses a 7-column device register + 5-column explanatory read-only context. Current browser gets a distinct label and no enabled revoke. Your authority uses a searchable ledger: action family, signed effective scope present?, current agent capability?, availability/reason; exact scope strings remain inspectable. This explains the existing intersection; it does not modify grants.

**Tablet.** Audit keeps time/action/outcome visible and moves actor/target into expandable rows at <1024. Device context follows register. Authority ledger becomes grouped sections for Paper operations, Host operations and local browser preferences; local preferences are labeled local, not granted server rights. Search and source controls stay above the result set.

**Mobile.** Operation records are two-line cards with time/action/outcome, then actor and exact target expansion. Tab labels may wrap to two lines but remain ≥44px. Device cards show name/ID/role/scopes count and Review revoke only when source gate permits; full target ID is mandatory in the review. Authority records show a sentence (“Granted, but Host offline”) plus the exact scope disclosure. No horizontal checklist of tiny badges.

**Interaction and states.** Changing audit authority clears/relabels results immediately, then only accepts matching ticket/source responses. Keep query limit 50; no invented infinite history. Denied full audit can use `audit.self` only where existing scope logic allows. Source returning an authorized empty list is S09; denied/failed query is S07/S11. `devices.list` may fall back to Host mirror under current logic, while revoke always targets Paper. S06 Host audit offline does not erase Paper identity or fabricate a global outage. A revocation grant/target/session change invalidates prepared review. Unknown outcome directs user to refresh device/audit evidence and avoid repeating revoke blindly. Capability undefined is not proven available; ledger must be at least as conservative as `session.reason`.

**Acceptance.** `R07-D`: 1440×900 each tab, clear audit-source label, readable outcomes and immutable scope context. `R07-M`: 390×844 long device/scopes/target records wrap; current-device disabled reason visible. Exercise Owner missing a scope, capability false/absent, Host mirror, Paper revoke unavailable, source switch late response, audit self-only and revoke review invalidation. Files: Access, shared evidence/copy/state components and route CSS; reconcileDeviceGrant/scopes untouched.

### R08 — Settings: a browser workspace, not server configuration

**Purpose and data.** Preserve four deep-linked sections, eight preference fields, origin save/reconnect, pairing another server, skin privacy and redacted build diagnostics. Do not restore historic display-rate or restart-schedule settings absent from this frontend HEAD. Local preferences must never appear to change backend permissions.

**Desktop.** Settings surface uses 208px section index + flexible form column (max 760px) + 240px live specimen where available. Appearance is arranged in three field groups: Viewing (theme/density/text), Signals (accent/fill/time zone), Motion. Small actual component specimens show text, a disabled action, a source label and a non-data chart placeholder; no fake live telemetry. Connections has relay form first and separate Pair another server surface second, with stored-pairing count/current server and connection feedback. Privacy & skins has provider choice, explicit direct-request disclosure and local fallback specimen. Diagnostics has copy action, build commit/time/protocol and separate Paper/Host captures. Hard-coded referenceDashboard/referenceCore fields, if exposed, must be labeled historical references, never deployed agent identity.

**Tablet.** At 820–1279 use 176px section index + remaining form; specimen moves below controls. At <820 section navigation is four labeled horizontal/two-by-two controls above the chapter. Connection and pairing forms stack; inputs use appropriate URL/password semantics and fill available width. Long origin/commit wraps in evidence displays, not in editable input value.

**Mobile.** Section selector near heading, one group per surface. Each option remains text-labeled (Dark/Light/System etc.); 3-choice groups stack if large text would squeeze them. Specimen sits after Appearance controls. Save-origin and Reconnect are separate actions; in Pair another server keep the existing masked code and conditional origin. Diagnostics use label over value and a full-width explicit copy button. Privacy choices show consequences before a provider is selected; provider failure does not trigger undisclosed alternative fetches.

**Interaction and states.** Appearance updates immediately and preserves exact stored enums/defaults. Feedback says “Applied in this browser” unless persistence is confirmed. System theme follows OS changes; OS reduced motion wins over full. Root text-size/density apply to every route, terminal and dialog. Connection save means preference saved, not reachability or paired success; connection state confirms it later. Invalid origin, storage unavailable, handshake rejected, no public default, absent build.json and clipboard denied each have distinct inline messages. S06 disconnected still permits local preferences. S07 server scopes do not disable local appearance. Do not display secret fields, mutate grant storage or create a skin proxy during this project.

**Acceptance.** `R08-D`: 1440×900 all four sections, coherent form labels/specimen/feedback. `R08-M`: 390×844 and 320px large text, every option accessible with no clipped tabs. Reload verifies all eight fields; theme system changes live; off motion is instant; skin disabled makes no provider requests; invalid relay never sends a token to another origin; copy is redacted. Files: Settings and preference styles; parser/startup/storage schema preserved.

## 6. Entry and shared operational surfaces

### Pairing / startup

Preserve 2, 800ms minimum splash and storage-initialization gate. Render an original static block mark and a short “Preparing your workspace” status; no fake progress percentage. Do not shorten the duration in a visual refactor. A future change to timing is a separate product decision with entry tests.

Pairing at desktop: centered 1040px two-column composition, 400px connection explanation and 520px form; single 480px form on tablet; 16px margins on mobile. Device name, masked one-time code, conditional HTTPS origin, Pair server. No sign-up, role picker, password manager, credential upload or social login. Read-only explanation: this browser receives scoped access; Paper and Host have separate responsibilities. A pairing accepted response leads to signed-session connection, not an instant mock dashboard. Show validation/pairing/rejected/accepted-connecting states without exposing code. Preserve name max 80, whitespace stripping/code max 128 and existing server claim behavior. Empty stored pairings always reach this flow after splash.

### Review / outcome

Desktop dialog max 640px, width calc(100%-32px); tablet max 600; mobile inset8px, max-height calc(100dvh-16px), independently scrolling content and visible footer. Header action-specific (“Review server restart”), target strip with full server name/ID and agent, exact subject ID/name, parameters, consequence, typed input when existing policy requires, Cancel and Dispatch. No decorative hidden payload.

Typed actions remain ban/kill/op/deop/backup.full.delete. Preserve confirmation metadata for HIGH_RISK, console.execute and plugin.command.reload. Busy cannot be double-dispatched; current native cancellation constraints remain. If review is invalid, disable Dispatch, explain change and require a fresh prepare. Result phases: prepared → dispatching → relay queued → authoritative agent result; manual backup acceptance then refers to durable job separately. Timeout/disconnect is unknown outcome, with read-only evidence navigation and no auto-retry. Avoid optimistic success animation.

### Source detail and command palette

Source detail uses native disclosure or modal with source, state, capture, receipt, age, optional cadence and session identity. No private credential or raw signed token. Palette groups routes and paired servers; it performs navigation/selection only, not destructive commands. Keep Ctrl/Cmd+K, Escape, focus restoration and no-results message. Mobile nav dialog shows all eight labels and current target, with clear close button; return focus to opener.

## 7. Charts and motion

### Chart anatomy

Reserve header/title/unit, plot, inspection shelf and evidence disclosure so cursor movement never changes panel height. Use 1.5–2px strokes, faint 1px grid, no unnecessary dots except isolated/pinned samples, and optional 8% fill. Missing data breaks stroke and fill. Tick labels standard ≥12px and do not collide at 320px; reduce tick count, not font size. Include original-sample table and screen-reader summary with sample count/window/source.

Display windows remain 1/5/15/30 minutes within 35-minute retained history. Summary statistics use actual eligible finite samples, not reduced paths; “observed mean” is a sample arithmetic summary, not a time-weighted SLA. GC is observed cumulative pause movement per minute; resets make it unavailable. Observed peaks/exceedances are retained-session/window quantities, not daily or lifetime claims.

Keep independent axes in comparison; do not overlay TPS, bytes and percent on one shared y-axis. A common inspection timestamp does not imply simultaneous capture. Expanding source/data disclosure does not restart streams. Active pin retains exact observation identity across resize and updates; return nearest timestamp explicitly labeled only if the original is still retained and source-valid.

### Motion table

| Event | Full | Reduced | Off / OS reduce |
| --- | --- | --- | --- |
| Hover/focus color | 120ms ease-out | 80ms opacity/color | Instant |
| Press | 80ms, translateY(1px) only | Color only | Instant |
| Route entry | 160ms opacity + 4px vertical, once per navigation | 100ms opacity | Instant |
| Dialog/nav entry | 180ms opacity + 8px vertical | 100ms opacity | Instant |
| Profile entry/Back | 160ms opacity, preserve focus/scroll | 100ms opacity | Instant |
| Disclosure | 140ms opacity; content reflows without fixed max-height trick | Instant | Instant |
| Copy feedback | Text/check change, 120ms opacity | Text change | Text change |
| Telemetry values/paths/progress authority | No tween or counting animation | Same | Same |

Use existing motion dependency only where CSS is insufficient; no new runtime. No ambient pulses, animated gradients, parallax, chart drawing on every update, springy layout shifts or sound. Maintain short state transitions without delaying action feedback or keyboard focus.

## 8. Settings mapping and originality gate

| Field | Exact values/default | Required visual effect |
| --- | --- | --- |
| theme | dark/light/system; dark | Equal-quality tokens; OS listener for system |
| density | compact/comfortable/spacious; comfortable | Padding/row geometry, not type shrink |
| textSize | small/standard/large; standard | Rem scale everywhere; terminal math follows measured row |
| accent | teal/blue/violet; teal | Signal/selection accent, stable semantic status |
| motion | full/reduced/off; full | Table above plus OS preference |
| chartFill | boolean; true | Area opacity only, never interpolate missing gaps |
| timezone | browser/UTC; browser | All displayed timestamps, with exact ISO in evidence where useful |
| skinProvider | proxy/crafatar/mc-heads/minotar/disabled; crafatar | Only chosen provider; disabled local; proxy requires separate deployment |

Legacy `reduceMotion:true` continues to migrate to reduced. Preserve optional localStorage failure behavior and initialization order. UI instance names never become default production records.

The redesign passes originality only if the delivered screenshots show the new horizontal frame, connected reading strip, instrument/terminal first row, source-layer resource register, recovery-first Backups, coherent exact-identity profile, single terminal workbench and authority ledger. A new palette over old JSX/card order fails. All eight route compositions, both themes and mobile are required before review readiness. Decorative assets cannot substitute for functioning, correctly scoped controls.
