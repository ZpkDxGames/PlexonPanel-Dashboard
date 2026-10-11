# Design system

## Intent

PlexonPanel is presented as an operations instrument: compact evidence first, action second, decoration last. Manrope supplies clear UI hierarchy while JetBrains Mono gives telemetry, identifiers and console output stable tabular rhythm. Both are bundled; no font CDN is used.

## Tokens

- Surfaces: canvas → surface → raised → overlay, with borders carrying more hierarchy than shadows.
- Accent: one restrained teal family. Green, amber, red and blue are reserved for semantic state and always paired with text or shape.
- Spacing: 4, 8, 12, 16, 24 and 32 px.
- Radius: 7 px controls, 11 px panels, 14 px overlays.
- Motion: route transitions at 180 ms; chart draw-in under 600 ms; user and OS reduced-motion settings collapse transitions to near-instant.
- Density: comfortable and compact alter shared spacing and row heights without reducing mobile targets.

Dark and light modes have separate palettes. The console remains an opaque dark terminal in both modes to preserve formatter colours and column contrast.

## Composition rules

Grouped KPI strips establish current condition. One dominant chart answers the main operational question; narrower evidence panels explain observed thresholds without inventing cause. Tables are bounded, named scroll regions. Destructive controls use the shared server-bound review dialog. The former full-width yellow clock alert is replaced by a compact clock-offset status chip with receipt-age semantics.

No gradient hero, decorative orb, oversized radius grid, emoji icon, fake number, smoothed chart interpolation or redundant title badge is used.
