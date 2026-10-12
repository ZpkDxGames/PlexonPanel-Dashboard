# PlexonPanel 6.0.0 visual review

## Method

All nine supplied PNGs and the running prototype were inspected before implementation. Baseline: all eight original routes × light/dark × 1440/390. Final capture: 13 routes × light/dark × busy/idle/offline × 1440×900 and 390×844 = 156 cases. Additional responsiveness: 360, 768, 1280, 1920 and 2560px. See `docs/revamp/before`, `docs/revamp/after` and `docs/revamp/qa`.

Final screenshots use fresh development-only fixture pages, self-hosted fonts, explicit themes and local pixel heads. The prototype is retained under docs/reference. No production value comes from the demo.

## Correction rounds

| Round | Concrete differences | Corrections |
| --- | --- | --- |
| 1 | Joined KPIs, 11px cards, fixed 0–100 TPS axis, monospace numbers, forensic headings, monochrome terminal | Ported tokens/DOM; separate KPIs; adaptive axes; tabular sans; owner copy; parsed rows |
| 2 | Sidebar pill stuck on Overview, letter heads, blank mini-console, sawtooth player history, clipped chart labels | Correct pill geometry; pixel fallback; 24-row preview; stepped demo history; three mobile time ticks/right inset |
| 3 | Low contrast counts/trace controls/tabs, invalid roles, scope wall, character-wrapped audit, hidden mobile controls | Contrast-safe ink; corrected ARIA; collapsed scopes; scroll hints; complete console tools |
| 4 | Literal &gt; prompt, overlong player detail, offline “Now”, optimistic backup headline | Decoded copy; collapsed advanced controls; last-sample/history labels; readiness-aware headline |

## Independent rubric scores

Reviewer read only screenshots/references/rubric, without implementation. Final light/dark busy at both widths, light idle/offline desktop, and the initial full Overview/Console matrix were independently reviewed. Root review and machine checks cover the remaining cases.

`s` denotes shared-system evidence from Overview/Console, not irrelevant widgets required on every settings page. Motion was provisional in the screenshot review; separate behavioral checks verify numeric, thumb and live-chart motion, plus reduced-motion safety. It retains a conservative score of 4.

| Page | Surface | Geometry | Color | Type | KPI | Charts | Density | Console | Motion | Copy | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Overview | 5 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 46 |
| Console | 5 | 5 | 5 | 5 | 4s | 4s | 4 | 5 | 4 | 4 | 45 |
| Players | 5 | 5 | 5 | 5 | 4s | 4s | 4 | 5s | 4 | 4 | 45 |
| Performance | 5 | 5 | 5 | 5 | 4s | 4 | 5 | 5s | 4 | 4 | 46 |
| Files | 5 | 5 | 5 | 5 | 4s | 4s | 4 | 5s | 4 | 4 | 45 |
| Backups | 5 | 5 | 5 | 5 | 4s | 4s | 5 | 5s | 4 | 4 | 46 |
| Settings | 5 | 5 | 5 | 5 | 4s | 4s | 4 | 5s | 4 | 4 | 45 |
| Plugins | 5 | 5 | 5 | 5 | 4s | 4s | 5 | 5s | 4 | 4 | 46 |
| Worlds | 5 | 5 | 5 | 5 | 4 | 4s | 4 | 5s | 4 | 4 | 45 |
| Schedules | 5 | 5 | 5 | 5 | 4s | 4s | 4 | 5s | 4 | 5 | 46 |
| Logs | 5 | 5 | 5 | 5 | 4s | 4s | 5 | 5 | 4 | 4 | 46 |
| Fleet | 5 | 5 | 5 | 5 | 4s | 4 | 4 | 5s | 4 | 5 | 46 |
| Access | 5 | 5 | 5 | 5 | 4s | 4s | 5 | 5s | 4 | 5 | 47 |

All pages clear 45/50; no category is below 4. The shared scores carry to idle/offline states where unavailable data is explicitly labeled. The static styleguide was directly compared before page building and remains excluded from production.

## Remaining gaps

1. Plain file editor lacks syntax highlighting and line numbers.
2. Some server-returned capability/error messages remain technical.
3. Player detail can be taller than a short roster; advanced sections are collapsed.
4. World cards repeat unavailable-control explanations.
5. Mobile tables require horizontal swiping, now signposted.

These retain 4-point scores. Physical-device 60fps, Safari/Firefox, screen-reader and live authenticated acceptance have not been executed; Chromium fixture evidence is not those certifications.

## Owner refinement — 2026-10-12 UTC

The owner removed Files/Plugins and requested Activity, chart/skin/Host/settings/icon refinements. Seven revised pages were reviewed independently against the same references. Surface/geometry/typography remain 5, shared components use the original evidence, and motion is established by separate executable behavior checks rather than inferred from still images.

| Page | Surface | Geometry | Color | Type | KPI | Charts | Density | Console | Motion | Copy | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Overview | 5 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 46 |
| Players | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 4 | 45 |
| Performance | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 4 | 45 |
| Backups | 5 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 46 |
| Settings | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 4 | 45 |
| Activity | 5 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 46 |
| Fleet | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 5 | 46 |

Correction loop: Activity initially scored 43 with density 3 (long identical rounded strips and clipped mobile filters). Replaced with eight compact divider rows, semantic icon chips/error tint, older-event expansion and wrapped measured-thumb tabs; corrected views score 46. A transient detached chart endpoint was fixed by driving the dot and path with identical interpolation coordinates. Empty Host fields were condensed; missing/new service series are labeled Awaiting sample/Collecting history. Settings copy and file-selector styling were corrected. Two captures caught a lazy loading skeleton; stronger content/landmark/font waits and fresh recaptures replace those images.

Reviewer actually inspected all seven healthy light desktop/mobile and dark desktop; dark healthy mobile Overview/Players/Performance; all twelve Players cases; all light idle/offline desktop; corrected Activity healthy light both widths/dark desktop, and light offline. All other combinations receive screenshot/axe/overflow/runtime checks. The reviewer subsequently inspected and accepted the replaced Fleet dark desktop (02:33:02 UTC): table, summary and both charts rendered correctly. Final review has no blocker.

Evidence: [84-case matrix](revamp/refinement/visual-matrix.json), [screenshots](revamp/refinement/screenshots), [refinement behavior](revamp/refinement/interactions.json), [retained behaviors](revamp/refinement/retained-interactions.json). Skin tests use controlled provider responses. Live authenticated skin/icon/Host acceptance is still unexecuted. Remaining 4-point gaps: backup stage markers are sparse, Players detail is taller than the roster, and idle Overview console has extra breathing room. No physical-device frame-rate claim.

## 6.5.0 final review — 2026-10-12 UTC

### Review set and correction loop

The supplied 1577×929 Owner/Console capture was the primary regression reference. Its title occupied the sticky top-bar row and the command composer was denied despite an Owner device. The first 6.5 pass also exposed data-shaped chart windows, slowly expanding axes, narrow tooltip crowding, a 6px mobile page overflow from carousel gutters and fragile full-Console height minima. The final pass uses explicit shell rows and route scroll reset, one action-authority resolver, capable-agent command targeting, fixed time windows, settling Y-domain hysteresis, plot-contained inspection and corrected compact gutters/heights.

The final capture contains 132 screenshots: all eleven routes × light/dark × 1440×900/390×844 × healthy/idle/offline. Every case has zero page overflow, zero runtime errors and zero axe violations. A separate 88-case viewport sweep covers 320×568, 360×640, 390×844, 768×800, 1024×720, 1280×800, the supplied 1577×929 viewport and 1920×1080 on every route. It verifies sticky-heading clearance, unclipped controls/text, chart crosshair/tooltip containment, the enabled Owner command input and all 54 effective Owner permissions.

An independent reviewer inspected all 132 final screenshots against the prototype, all supplied reference images, the rejected anti-reference and the Section 14 rubric. Motion receives a conservative 4 because still images cannot establish runtime behavior; executable browser checks separately verify chart morphing, numeric/segmented movement and reduced-motion paths.

| Page | Surface | Geometry | Color | Type | KPI | Charts | Density | Console | Motion | Copy | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Overview | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 5 | 49 |
| Console | 5 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 5 | 47 |
| Players | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 45 |
| Performance | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 4 | 5 | 47 |
| Backups | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 45 |
| Settings | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 45 |
| Worlds | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 45 |
| Schedules | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 45 |
| Activity (`#Logs`) | 5 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 4 | 5 | 46 |
| Fleet | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 4 | 5 | 47 |
| Access | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 45 |

**Verdict: pass.** Every route is at least 45/50 and no category is below 4. The strongest pages are Overview (49) and Console, Performance and Fleet (47). The light glass, polished dark variant, 24px card language, categorical hues, chart anatomy, semantic console and Minecraft-specific copy remain aligned with the supplied system; none resembles the rejected flat developer-tool reference.

### Functional and performance evidence

- 56 TypeScript/unit/contract tests pass, including full effective Owner scopes, chart-axis recovery after an old spike, command normalization and bounded/deduplicated history policy.
- 16 refinement and 27 retained browser interactions pass: direct safe command dispatch, completed-only history recall/clear, lifecycle agent confirmation, typed dangerous-command review, inert hostile markup, themes, telemetry motion, source freshness, skin fallback, icon flow and no production-relay contact from demo. Individual history removal is covered by the command-history unit policy and the same persisted-state path as clear-all.
- The 100,000-line retained console check remains bounded at 2,500 entries and 16 rendered rows in the recorded run.
- Production build passes. The initial route is 99,871 bytes gzip against the 184,320-byte budget; the main generated chunk is 100.89 KiB gzip.
- Lighthouse against `vite preview`: mobile 99 Performance / 100 Accessibility / 100 Best Practices (LCP 1.6s, TBT 0ms, CLS 0.001); desktop 100/100/100 (LCP 0.5s, TBT 0ms, CLS 0).

Evidence: [final screenshots and axe matrix](revamp/6.5.0/final), [responsive results](revamp/6.5.0/responsive-results.json), [interaction results](revamp/6.5.0/refinement-interactions.json), [retained interaction results](revamp/6.5.0/retained-interactions.json), [Lighthouse summary](revamp/6.5.0/lighthouse-summary.json), [bundle budget](revamp/6.5.0/performance.json), and the [supplied-viewport fix](revamp/6.5.0/console-fixed-1577x929.png).

### Console and lifecycle interaction correction

The supplied failure capture was reproduced: the Stop/Restart dialog completed visually but dispatched without the relay-required confirmation parameter. The corrected review dispatch was browser-tested for both operators, including the resulting action payload. Safe Console input now clears only after completion; dangerous commands still require typed review; cancelled commands do not enter history. The mobile Console was recaptured after moving History ahead of macros and bounding the terminal height so the composer, history, macros and fixed navigation remain fully reachable.

The independent post-fix Console review remains **47/50** (Surface 5, Geometry 5, Color 5, Typography 5, KPI 4, Charts 4, Density 5, Console 5, Motion 4, Copy 5), with no category below 4 and no blocker. Evidence: [desktop history](revamp/6.5.0/console-history-fixed.png), [mobile history](revamp/6.5.0/console-history-mobile-dark.png), [mobile fit](revamp/6.5.0/console-mobile-fixed.png) and [lifecycle confirmation](revamp/6.5.0/lifecycle-confirm-fixed.png).

### Remaining gaps

1. Physical safe-area/keyboard behavior, Safari/Firefox, screen readers and physical-device frame pacing are not certified by the Chromium matrix.
2. Mobile backup and audit tables intentionally use labelled horizontal scroll; stacked-card alternatives could reduce swiping.
3. Console mobile truncates long rows to protect layout; expanded/copy controls remain contextual rather than always visible. The input, History control and macros remain fully reachable above fixed navigation.
4. Worlds, Schedules, Access and idle Players are naturally sparser than telemetry-heavy pages.
5. Live authenticated skin, signed server-icon and VPS Host-relay acceptance could not be run without the owner's paired browser/server environment.
