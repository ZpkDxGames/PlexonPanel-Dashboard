# PlexonPanel design system

## Direction

PlexonPanel is a calm, high-density operations console: evidence first, actions second, decoration last. The visual language uses graphite/navy surfaces, restrained “signal teal” emphasis and precise status color. It deliberately avoids gaming neon, broad glass effects and decorative motion.

Manrope is the variable UI face. JetBrains Mono is reserved for console output, IDs, bytes, timestamps and changing measurements. Both font packages are bundled locally. Live values use tabular numerals so telemetry updates do not shift surrounding content.

## Semantic tokens

`src/styles.css` is the canonical visual token source. `src/motion.ts` mirrors the durations and emphasized easing needed by React animation APIs.

- Surfaces: `canvas`, `surface-1`, `surface-2`, `surface-3` and `overlay`. Dark mode uses tinted near-black layers and inner highlights; light mode uses cool neutrals and softer external shadows.
- Accent: signal teal by default, with Azure and Violet preferences. Each choice drives accent, hover, active, subtle, border and on-accent tokens. Status colors remain semantic and do not change with the accent.
- Status: ok, warning, danger, info and neutral each have foreground, subtle background and border tokens. Color is always paired with a dot, label or shape.
- Radius: a 4 px micro radius for small indicators, then 6, 10, 14 and 20 px plus full/pill. There are no component-specific arbitrary radii.
- Spacing: a 4 px base scale from 4 through 40 px. Compact, comfortable and spacious alter shared control height, row height, panel padding, section gap, gutter and top-bar tokens.
- Typography: 13, 14 and 15 px root sizes implement small, standard and large preferences without per-component overrides.
- Motion: instant 80 ms, fast 140 ms, base 220 ms, slow 360 ms and page 480 ms. Full motion uses standard, emphasized, soft and restrained spring-like easings. Reduced mode shortens timing and replaces translation/scale with opacity. Off mode zeros all transition and animation durations.

The only continuous animations are a live-status pulse, a loading skeleton or progress shimmer, an indeterminate backup bar and a loading-button spinner. Reduced motion makes these static; off motion removes them.

## Composition

- The fixed rail groups Monitor, Operate and System destinations. A shared Motion layout indicator carries selection between routes.
- The compact context bar keeps selected-server identity, freshness, authority and theme access visible without becoming a second page header.
- Workspaces share one heading rhythm, a 1720 px maximum content width and the same Panel, Button, Status, Notice, field, table and empty-state rules.
- Six Overview metrics form the hero strip. Paper process CPU and Host machine CPU remain separately named, sourced and charted.
- Native SVG charts preserve missing intervals, expose keyboard inspection and a sample-table alternative, format units at the axis, flip the crosshair tooltip at the edge and never interpolate across gaps.
- The dark terminal palette is intentionally stable in both themes so ANSI, source and severity colors retain predictable contrast.
- Backup progress is always derived from reported operation state. Unknown progress is indeterminate, while unknown preflight values keep creation disabled and are rendered as `unknown`.

## Interaction and accessibility

All controls share focus-visible rings, 44 px mobile targets, pressed/disabled/loading states and existing authorization reasons. Drawers and the command palette trap focus, close on Escape, restore prior focus and make background content inert. The command palette can only navigate to an existing workspace or select an already paired server; it never dispatches an operation.

Theme changes use the View Transitions API when supported and fall back to an immediate token change. Lazy workspaces use layout-matched skeletons. Route changes, panels, status transitions, list additions, toasts and overlays use transform/opacity-based effects and respect both the saved motion preference and `prefers-reduced-motion`.

## Truth and security rules

Presentation must not imply authority or observations that do not exist. Missing data says unavailable or unknown; zero remains a real value. Host and Paper evidence stay separate. Console authority uses exactly `HOST`, `PAPER_FALLBACK` or `UNAVAILABLE`. Disabled actions retain the same scope, capability, presence, policy and confirmation gates as the adapter layer.

Development fixture screenshots are visibly labelled and block dispatch. Production builds retain the structural fixture exclusion.
