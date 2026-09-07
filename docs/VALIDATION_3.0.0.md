# Dashboard 3.0.0 viewport and interaction validation

This document is the release acceptance matrix for the PlexonPanel Dashboard 3.0 Control Room. It separates automated source/build gates from manual browser/live-server gates so a green CI run is not mistaken for visual or operational production approval.

## Automated gates

The repository workflow must complete all of the following on the exact release commit:

- `npm ci`
- `npm run check`
  - ESLint
  - application TypeScript
  - relay TypeScript
  - relay tests
  - project/state/UI tests
  - production-build regression test
- `npm run relay:smoke`
- `npm run build`

Dashboard 3.0 additionally contains regression coverage for:

- the active 10-page Control Room set with Files/Backups absent from active navigation;
- dormant Files/Backups protocol/scope compatibility;
- no global `zoom` or `transform: scale(...)` responsive workaround;
- named container-query composition;
- all supported browser-local display-update cadences;
- 3.0 style-layer ordering after legacy compatibility layers.

## Required viewport matrix

Capture the active Control Room at each viewport below using representative authorized telemetry. A row passes only when navigation, page header, primary content, dialogs/drawers and critical controls are usable without page-wide accidental horizontal scrolling, clipped controls, overlapping text, or scaled-down desktop composition.

| Viewport | Primary checks | Status / evidence |
| --- | --- | --- |
| 320 × 568 | Mobile navigation, Overview signals, Players cards, Console command bar, centered confirmation | Manual evidence required |
| 360 × 800 | Safe-area/mobile sheet behavior, Settings controls, Audit timeline | Manual evidence required |
| 480 × 900 | Mobile-to-narrow composition transition, toolbars and tables | Manual evidence required |
| 768 × 1024 | Tablet/sidebar transition, Performance charts, Access capability groups | Manual evidence required |
| 1024 × 768 | Short-height laptop rules, sticky chrome, console useful height | Manual evidence required |
| 1366 × 768 | Required laptop target; first-viewport density and dialogs | Manual evidence required |
| 1440 × 900 | Standard desktop baseline | Manual evidence required |
| 1920 × 1080 | Standard large desktop, chart density and content width | Manual evidence required |
| 2560 × 1440 | Wide layout columns without stretched reading surfaces | Manual evidence required |
| 3440 × 1440 | Ultra-wide density and bounded content composition | Manual evidence required |

## Zoom and text-size gates

Validate at browser zoom 100%, 125%, 150% and 200% on at least 1366×768 and 1920×1080. At 200% the dashboard may switch to narrow/mobile composition, but controls must remain operable and no modal may render outside the viewport.

Also verify the browser-local text-size preferences at 100%, 112.5% and 125%. Text size is an accessibility preference; it must not act as a viewport scaling mechanism.

## Overlay and drawer gates

For confirmation dialogs and the command palette:

- center against the visual viewport, not the sidebar/content rectangle;
- remain fully reachable after document scroll;
- remain centered with the sidebar expanded or collapsed;
- keep primary/destructive actions visible on short-height screens;
- keep backdrop and z-index behavior consistent.

For Players, Audit and Access drawers/sheets:

- desktop uses a bounded side drawer;
- mobile uses a safe-area-aware full-width sheet;
- long UUIDs, request IDs and capability labels wrap or truncate locally without moving the whole page.

## Console gates

With an authorized live stream:

1. Follow the live tail and confirm new lines remain visible.
2. Scroll upward and confirm follow-tail disengages automatically.
3. Receive additional lines and confirm the viewport is not pulled down.
4. Confirm the bounded new-line counter / return-to-live-tail affordance appears.
5. Return to the tail and confirm the counter clears.
6. Test wrapped and unwrapped output, severity filtering, search, copy, local-clear and command history.

## Display update rate gates

Test Realtime, 250 ms, 500 ms, 1 s and 2 s presentation cadences.

- WebSocket receipt/order must remain authoritative and continuous.
- Console/chat ordering must remain intact.
- Connection/authentication/lifecycle state must not be intentionally delayed.
- Switching cadence while a render flush is pending must not leak timers or lose the latest safe visible state.
- The setting must not change Paper/Host telemetry production intervals.

## Failure-state gates

Exercise at least:

- relay unavailable / reconnecting;
- Paper offline with Host online;
- Host unavailable/not installed;
- cached browser state while disconnected;
- locally disabled capability;
- scope absent from current immutable device grant;
- action denied/failed;
- empty telemetry history and unsupported/missing metric;
- avatar provider unavailable/failing.

The UI must report the actual state rather than substitute invented sample data.

## Production acceptance

Do not mark Dashboard 3.0 production-accepted until the exact release commit has:

1. a green repository workflow including relay smoke and production build;
2. completed viewport/zoom evidence above;
3. keyboard/focus and reduced-motion checks;
4. a disposable live Paper/Host acceptance pass for the operations the release surfaces;
5. confirmation that existing protocol-3 credentials, signing identity, Durable Object namespace and local policy were preserved.

A merge or Vercel preview alone is not production acceptance.
