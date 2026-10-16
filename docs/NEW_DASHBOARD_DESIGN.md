# Reference Control Room — design decisions

The four owner references define the visual family. Reference 3/4 supplies the hosting-panel composition, reference 1 the rounded modules and aligned fields, and reference 2 the substantial player identity/profile hierarchy. The new source brief is `REFERENCE_UI_REVAMP_BRIEF.md`.

Two variants were considered within this direction: a narrow icon rail with a secondary server column, and a persistent labelled sidebar with a two-column server workspace. The labelled sidebar was selected because it preserves clear destinations, matches the references, and remains understandable without hover. Tablet/mobile uses an accessible native-dialog drawer.

## Rebuilt presentation

- A 240px grouped sidebar, scoped server switcher, device identity and relay status replace horizontal navigation.
- Compact operational heading, original local voxel landscape, explicit server status and reviewed lifecycle controls replace the editorial hero.
- Overview now combines server information, a real bounded console preview, usage selector/chart, resource summary, quick navigation, player preview and world/tick modules.
- Fleet becomes a searchable card directory with independent source health, identity disclosure and verified-node measurements.
- Performance moves from an editorial signal rail to an eight-signal instrument selector and substantial focused/comparison panels.
- Players replaces its side dialog with an in-page identity header, current-session facts, gameplay/moderation/command panels, and a gated read-only history panel. A disappearing UUID never silently selects another player.
- Console, chat, plugins, backup readiness/archive/job modules and access views use the same operational panels. No screenshot-only feature was added.
- Settings is a four-section workspace with deep-linkable Appearance, Connections, Privacy & skins and Diagnostics panels. Preference feedback is immediate; relay save has a distinct pending state.
- Splash, pairing, recovery, search and reviewed dialogs receive the same surfaces and focus treatment.

## Visual system

Charcoal canvas, navy/sidebar, three levels of blue-grey panels, 16px panel geometry, blue actions and cyan instrumentation. Independent light surfaces use white, cool neutral canvas and darker accessible signal colors. Manrope and JetBrains Mono remain self-hosted. The original preference schema and stored accent choices remain supported; the teal option now has a cyan interpretation within the requested palette.

The former 111KB stylesheet was replaced by one token/component/responsive system; no override stylesheet or dashboard kit was added. The SVG header artwork is original local vector artwork, not a third-party brand or hosted asset.

Real data remains literal: source clocks, skew, gaps, source generations, actual samples and CPU denominators are preserved. The tested existing chart projection/reduction engine remains in use. The new usage selector only filters retained observations.

Proof renders at 1440×900 and 390×844 exposed a lower-than-intended usage panel and a light-theme contrast issue. Both were corrected before the final capture matrix. Full-page screenshots show the complete workspaces; viewport captures establish actual 100% scale. Every fixture screen is labelled.
