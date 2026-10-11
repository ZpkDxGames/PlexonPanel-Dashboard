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
