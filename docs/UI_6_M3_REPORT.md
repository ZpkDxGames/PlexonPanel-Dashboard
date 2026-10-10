# UI 6 M3 report

Branch `release/6.0.0`. M2 follow-ups, M3a and M3b are complete. Decisions 14–16 supersede the earlier M2 stop boundary. Characterization passed before extraction; the Host-only correction has its own commit; all M3a exit gates passed before M3b began. No push, tag, main edit or deployment. **Stopped before M4 for maintainer review.**

## M2 follow-ups

Read-only inputs/selects now show **Read only** and a double border. Disabled/empty controls show **Unavailable** and a dashed border. Read-only controls remain focusable; read-only selects cannot open/change options. Disabled controls remain outside keyboard interaction. These cues use opaque existing tokens in both themes. The foundation runner asserts the words, border shapes and read-only keyboard behavior.

**Toast decision:** retain the left stripe for quick scanning; each toast also supplies a distinct icon and an explicit status word, so the stripe is never the only cue. Long words wrap at 200% text without displacing dismiss controls.

The UI stack already placed `hankenLatin Fallback` immediately after `Plexon Hanken`. The mono stack omitted it; it now follows Hanken there too. The production-emission test checks both stacks and the fallback's metric declarations. The measurement uses cold cache, an artificial 1.2-second font delay, light/dark × 390/1280 × three repeats, on the real kitchen sink and signed local production Fleet. It measures the maximum CLS session window and retains source rectangles and font request timing. Live-card hydration and font swap both contribute. This is an existing performance issue, not a claimed pass against the brief's 0.05 budget. This single-process Linux browser reports local-font lookup unavailable; the adjusted Arial face's effect on an installed-Arial machine is **not executed** here.

| Surface | Width | Before max, light / dark | After max, light / dark |
|---|---:|---|---|
| Kitchen sink | 390 | 0.031177 / 0.031177 | 0.031177 / 0.031177 |
| Kitchen sink | 1280 | 0.000984 / 0.000984 | 0.000984 / 0.000984 |
| Signed production Fleet | 390 | 0.153232 / 0.153591 | 0.163250 / 0.163609 |
| Signed production Fleet | 1280 | 0.039091 / 0.039091 | 0.039091 / 0.039091 |

No CLS improvement is claimed. Median production light/mobile is unchanged (0.153232); variation comes from when signed live cards hydrate relative to the delayed font. Production Fleet's mobile budget still fails and requires the later Fleet/boot layout work; M3a cannot change markup/CSS to conceal it. Raw measurements and source rectangles are retained in `ui6-m3/followups/`.

### Contrast pair accounting

| Calculation | Required pairs |
|---|---:|
| M1: 14 text/status/accent candidates × 4 surfaces × 2 themes | 112 |
| M1: boundary × 4 surfaces × 2 themes | 8 |
| M1: on-accent × 7 candidates × 2 themes | 14 |
| M1 total | **134** |
| Remove unselected lapis/copper: 2 × 4 × 2 text pairs + 2 × 2 filled pairs | −20 |
| Add filled critical/danger button × 2 themes | +2 |
| M2 shipped total: 96 text + 8 boundaries + 12 filled | **116** |

The discrepancy reflects the shipped candidate set, not omitted required contrasts. Canonical JSON still preserves the design candidates. The rerun reads actual CSS against that JSON: all 116 required pairs pass, minimum text 5.136208:1, essential boundary 3.876348:1. Eight quiet decorative separator failures remain explicitly non-text/non-interactive. New mode cues use muted text on existing opaque surfaces; no new composite colors were introduced.

Foundation follow-up gates passed: `npm run check` (79 relay +201 dashboard tests, zero failures); 20 axe scans with zero violations; 116 required contrast pairs; non-color cue/read-only keyboard checks; 200% text and forced colors. Raw axe incomplete reviews remain preserved. [Evidence](ui6-m3/followups/kitchen-verification.json), [contrast](ui6-m3/followups/contrast.json), [CLS summary](ui6-m3/followups/cls-summary.json), [check status](ui6-m3/followups/check-status.json).

## M3a gates

| Gate | Status |
|---|---|
| New characterization tests green before extraction | passed; 32 tests, original Dashboard SHA recorded |
| `npm run check` after extraction/correction | passed; 79 relay +206 dashboard, zero failures/skips |
| Signed two-room mounted flow after extraction/correction | passed; 18 mounted subcases (also part of full check) |
| Existing `scripts/verify-ui-browser.mjs` unchanged | passed; 162 responsive views, 26 axe scans zero violations, 60.010-second soak, zero JS errors |
| Diff review: no markup/CSS change in M3a | passed; 21 JSX subtrees and all 11 CSS files byte-identical |

M3a commits: characterization `40d159a`, extraction `e1a6e11`, separate Host correction `7792d2d`. [Before characterization](ui6-m3/m3a/characterization-before.txt), [final full check](ui6-m3/m3a/check-status.json), [unchanged browser verifier](ui6-m3/m3a/browser-results.json), [diff review](ui6-m3/m3a/extraction-diff-review.json). Source architecture assertions now follow the extracted owners; runtime conditions are preserved except the explicitly approved Host-only correction. The palette regression exercises signed missing Host state with Paper connected and confirms no lifecycle dispatch.

The browser verifier ran on exactly `7792d2d` in a detached isolated checkout. Its accepted-evidence output path writes only that copy; this repository's accepted 5.0 evidence is unchanged. Turbopack rejected an outside-root dependency symlink on first startup; a physical dependency copy fixed the environment. The Chromium wrapper adds software-safe WebGL flags without changing the verifier. Captures generated by the successful run are retained separately, selected by its capture start time. All M3a exit gates were green, so M3b proceeded without another approval. Initial production root JS before M3b was 701,911 bytes /217,425 individually gzipped bytes; the entire static-JS set was 895,235 /278,323. [Bundle measurements](ui6-m3/m3a/bundle-before.json). M4 remains outside scope.

## M3b implementation and review

The new shell replaces the old one: Fleet stays global; Monitor/Operate/Manage group the workspaces. The server header shows Relay, Paper, Host and supplied console authority separately. The disclosure distinguishes browser receipt time from service capture time and identifies the bound instance/role. The palette navigates only, with Ctrl/Cmd+K and discoverable keyboard shortcuts; Restart lives in Server's existing bound review. Native drawer behavior applies below 1024. Boot and pairing use the same storage/signed pairing flow. The activity tray retains only the latest 50 metadata entries in this tab, with no content or persistence. M4's compact Pulse has reserved geometry only.

All 13 workspace views are dynamic imports behind a two-frame shell-paint gate. Existing views have a single scoped legacy CSS owner, imported by the deferred workspace owner (and by legacy preferences when opened). The initial root loads neither workspace JavaScript nor its CSS. Palette/rail/drawer/server changes use the extracted dirty-leave and target protections. The signed anchor now has 19 mounted subcases, including every palette destination, server choices and dirty drawer navigation. Navigation can mount existing authorized read queries; it cannot initiate a mutating operation. New metadata tests check content dropping, canonical names, bounded retention, repeated completions and phase/source snapshot deduplication.

### Anti-template self-review

- **Hierarchy and identity:** restrained Hanken typography, an unaccented wordmark, a compact global Fleet entry and three quiet navigation groups. Authority is a readable four-source line with details on demand; it does not merge Paper connectivity into service state.
- **Purposeful surfaces:** the shell uses layout/separators rather than a grid of decorative cards. Floating surfaces belong to an actual choice, disclosure or bound confirmation. The neutral palette remains compatible with all saved accents.
- **Typography:** UI and shortcut keys use Hanken; new command/UUID text uses Commit Mono 400. Legacy configuration/code keeps its existing system monospace pending workspace rebuilding. The adjusted fallback is in both foundation stacks; no universal script coverage is claimed.
- **Motion/data honesty:** no gradients, glows, emoji, synthetic metrics, animated dots or decorative pulse. The reserved Pulse slot contains no fake visualization. Connection states, capture timestamps and unknown values come from existing packets/model state.
- **Weakest choices:** this rail/header is deliberately conventional and its distinct instrument identity is not complete until M4. At 390 the authority/header consumes vertical space; hiding client-settings text leaves an accessible named icon, but touch recognition deserves real-device review. A fixed desktop rail requires its own scrolling on short viewports. The authority popover is dense on a phone. The Overview's six equal legacy cards and rounded Fleet surfaces remain visibly transitional; this milestone does not claim their redesign.
- **Accessibility/performance limits:** native focus/keyboard behavior is proven in Chromium, not all engines/assistive technologies. Retained Fleet still has its known definition-list failure and mobile hydration CLS debt, explicitly assigned to M4. Software-rendered local browser timing is not a mid-tier-device INP/LCP certificate.

### M3b executed gates

| Gate | Result and evidence |
|---|---|
| `npm run check` on final source | **passed**; lint, TypeScript, actual production build, 79 relay +211 dashboard tests; zero failures/skips. [Status](ui6-m3/m3b/check-status.json), [complete transcript](ui6-m3/m3b/check.txt). |
| Signed mounted anchor | **passed**; 19 mounted subcases, including immutable confirmation parameters, selection/generation invalidation, grant intersection, dirty rail/drawer/palette/switcher navigation and no mutating operation from navigation. Included in full check. |
| Production shell screenshot matrix | **passed**; light/dark at 360/390/768/1024/1280/1920. 67 state screenshots plus four shell-before-workspace captures. [Gallery](ui6-m3/m3b/README.md). |
| Axe: new shell, drawer, palette, authority, shortcuts, boot, pairing, session tray | **passed**; 67 scans with zero violations. Raw incomplete results preserved; 118 live-DOM reference checks and 389 rendered opaque-color reviews pass. [Raw results](ui6-m3/m3b/shell-verification.json). |
| Axe: whole retained Fleet | **failed**; four scans (light/dark ×390/1280) retain only `definition-list`. The shell-only Fleet scan explicitly excludes the legacy workspace. This is decision 13's M4 exit gate, not a claimed whole-app pass. |
| Keyboard-only walkthrough | **passed**; drawer trapped 22 Tab steps in each of six mobile/theme cases, background inert, Escape restores opener; keyboard palette navigation and `g` chord pass, typing ignored, zero mutating requests. [Results](ui6-m3/m3b/summary.json). |
| Shell paints before workspace JS **and CSS** | **passed**; actual `next build` + `next start`, cache disabled, both themes at 390/1280; shell visible and legacy DOM absent while owner request is held. Both actual deferred requests begin after the shell paint mark. Initial-script/style exclusion test passes. [Build/paint proof](ui6-m3/m3b/production-shell.json), [explicit CSS requests](ui6-m3/m3b/production-css-order.json), [four emitted-build tests](ui6-m3/m3b/emitted-build-tests.txt). |
| Production font CSS/cold-cache network trace | **passed**; Latin-only preload, range-qualified Hanken faces, adjusted fallback in both stacks; Portuguese/English does not request extended, Ł requests it once, Ж uses native fallback. Commit Mono 400 renders commands. [Trace](ui6-m3/m3b/production-font-trace.json). |
| Contrast rerun | **passed**; all 116 required pairs; minimum text 5.136208:1, essential boundary 3.876348:1. No new composite colors; existing overlay/shadow composites remeasured. [Measurements](ui6-m3/m3b/contrast.json). |
| Development kitchen-sink exclusion | **passed**; actual production app manifest and emitted chunks checked by automated test; production URL 404. |
| Main, dependencies, protocol/relay, signed transport/store/reducers and accepted 5.0 evidence | **passed**; unchanged. [Final scope review](ui6-m3/m3b/scope-review.json). |
| Other engines, real devices, screen readers; mid-tier-device INP/LCP; live deployment | **not executed**. Local software-rendered Chromium evidence is not a certificate for these gates. |

### Production payload, paint and layout shift

The production evidence uses build `R2qMbEzCng4u6Q6Fr8CAY`. Its build ran successfully before the matrix, font trace and bundle measurement. The final full check rebuilt the same source separately with its test relay configuration. The supplemental CSS-order trace reuses the evidence build and records `buildExecuted: false`; it is not presented as a second build.

| JavaScript payload | Before M3b, raw / individually gzipped bytes | After M3b, raw / individually gzipped bytes | Gzip change |
|---|---:|---:|---:|
| Actual initial root script set | 701,911 /217,425 | 658,963 /205,063 | −5.69% |
| Entire emitted static JS set | 895,235 /278,323 | 999,397 /314,203 | +12.89% |

The complete set includes deferred workspaces; it is not the initial request set. Configuration URL literals differ between the baseline test build and the local signed-fixture build, so these are concrete payload measurements, not a controlled runtime-speed claim. [Before](ui6-m3/m3a/bundle-before.json), [after](ui6-m3/m3b/bundle-after.json).

| CSS-order trace | Shell paint mark (ms) | First workspace CSS request (ms) | Workspace owner JS request (ms) |
|---|---:|---:|---:|
| Light 390 | 131.800 | 133.673 | 134.019 |
| Light 1280 | 105.200 | 106.657 | 106.880 |
| Dark 390 | 103.200 | 105.111 | 105.364 |
| Dark 1280 | 160.600 | 162.343 | 162.620 |

Times are relative to navigation in the actual browser. The runner holds the workspace owner request, verifies the painted shell and absent legacy DOM, then releases it. This proves load order; it does not simulate a production network or establish LCP/INP.

Across the fresh-build and supplemental cold-cache runs (eight samples), shell-only CLS is at most **0.010398**, below 0.05. Including retained Fleet is **0.087064–0.089431 at 390 (failed)** and **0.037313–0.039097 at 1280 (passed)**. Footer displacement during workspace mounting and live Fleet status changes remain visible in raw shift rectangles. These measurements have no artificial font delay and are not directly comparable to the earlier 1.2-second-delay fallback experiment. M4 owns the retained Fleet/layout debt.

Only Hanken Latin is preloaded. The initial pairing page also requests Commit Mono because it displays the real `/plexonpanel pair` command; Mono is not preloaded. The extended face is absent until an extended-range glyph is rendered. The Linux local-font lookup limitation remains: adjusted Arial behavior on a machine with Arial installed is **not executed**.

Overlay and shadow alpha composites contain no text and are decorative. Opaque floating content measures text/muted/boundary **16.095531/7.240653/4.620608:1 light** and **10.485750/6.956204/4.072594:1 dark**. Quiet separators are decorative; their eight below-text-threshold pairs are preserved and not counted as required passes.

M3b is complete and committed locally at the end of this milestone. M4 is unstarted; await maintainer review before rebuilding Overview, Fleet or rendering Pulse.
