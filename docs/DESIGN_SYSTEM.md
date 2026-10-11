# PlexonPanel 6.0.0 design system

The supplied [prototype](reference/plexonpanel-reference.html) defines the design. Its light and dark token blocks are copied into `src/styles/tokens.css`. The ported base styles are `src/styles/reference.css`; `src/styles.css` contains application layouts and capability states. The former visual layer has been replaced.

## Tokens and typography

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | indigo/sky/violet radial washes on #eef0fc | same composition on #080d26 |
| Card | rgba(255,255,255,.68) | rgba(24,31,78,.58) |
| Main text | #0f1535 | #f1f3ff |
| Primary | #4a3fe0 | #7b78f2 |
| Categorical order | players indigo, ticks teal, memory orange, CPU sky, extras magenta | same entities, prototype dark variants |
| Geometry | 10 / 16 / 24px radii; 20px grid gaps; 22–24px main card padding | identical |
| Elevation | hairline + layered shadow + 18px blur where useful | same anatomy with dark shadows |

Plus Jakarta Sans Variable is self-hosted; JetBrains Mono remains self-hosted for commands, identifiers and terminal output. Metrics and tables use tabular sans figures. Icons use the existing project-owned 1.75px SVG set, extended for the new pages. The original block mark and local pixel head are SVGs, not trademark textures.

Primary/series tokens remain unchanged. Small status text uses stronger `--ok-ink`/`--warn-ink`; labels on sunken controls use `--t2`; selected dark tabs use `--t1`. These component-level contrast fixes retain the supplied categorical palette. Minecraft/ANSI color maps remain formatting data rather than UI palette tokens.

## Component catalogue

| Component | Use and rules |
| --- | --- |
| Panel / card | Consistent title/subtitle/action header, 24px radius, surface, border and shadow. Tables scroll inside the card. |
| Button / Status / Notice | Pill controls and text+dot statuses. Unknown/offline remain distinct from zero. Signed capability checks gate actions. |
| Kpi | Colored icon chip, label/sub-label, 32px reading, contextual pill, sparkline or segmented memory track. Values tween between real readings. |
| TimeSeries / Sparkline | Adaptive domains, minimum spans, bounded decimation, gradient area, warning threshold, endpoint and pointer/keyboard tooltip. Missing data splits paths. Table alternative retained. |
| Segmented | Measured shared thumb; 350ms transform with prototype easing. Dark selected text is contrast-safe. |
| ConsoleView / LogViewport / LogRow | Navy terminal in both themes; source and level columns, semantic tints, duplicate count, collapsible trace, counts, prompt and macros. Overscan keeps DOM bounded. |
| PlayerHead | Configurable real provider URL or original local pixel fallback. Provider changes reset failure state. |
| Shell | Navy sidebar, sliding active pill, selected server, sticky glass bar, native modal palette, More navigation on mobile. |
| ActionReview | Native focus-trapped modal; Cancel gets initial focus. Consequences and typed confirmation where appropriate. Server outcome remains authoritative. |
| File editor | Plain text textarea, dirty state, Ctrl/Cmd+S review, original hash and navigation guard. Text uploads capped at 24 KiB. No IDE-style syntax intelligence claimed. |

## Motion and accessibility

Press 120ms, hover/state ~220ms, sliding selection 350ms, counts 600ms, chart reveal 1400ms. Live chart motion lasts one observed sample interval. Overview cards enter in one bounded stagger. System/local reduced-motion preferences stop CSS loops and skip numeric/chart motion. Blur is excluded from rows and most scrolling cards; unsupported browsers get solid surfaces.

Native modals handle focus and Escape. The shell has a skip link. Charts support arrow keys and a data table. Mobile table overflow is contained and signposted. Themes initialize before paint with an inline script whose exact SHA-256 is allowlisted by Vercel CSP; unrestricted inline scripts are not allowed.

## Screens and extension

[Overview light](revamp/after/Overview-light-1440-healthy.png), [Overview dark](revamp/after/Overview-dark-1440-healthy.png), [Console](revamp/after/Console-light-1440-healthy.png), [mobile idle](revamp/after/Overview-light-390-idle.png).

Add a lazy route in `src/App.tsx`, its label in `src/router.ts`, and its shell icon/description in `src/components/Shell.tsx`. Compose existing primitives and put static copy in `src/i18n/en.ts`. Network access belongs in the existing session/adapter layer. Never fabricate sources or infer per-tick percentiles from average samples. Capture and score the complete state/theme/viewport matrix.
