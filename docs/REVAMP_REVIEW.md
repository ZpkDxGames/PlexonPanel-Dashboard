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
