# v5.2 Polish & Offline Skins

Display choices now persist in the validated `plexon:view-sync` UI store. Overview and Performance share the horizon and active series; Overview shows 35m when the retained choice is 2h. Console/chat content, filter text, input text and command history remain volatile. The eight-key preferences store and all 27 checksum-locked core files are unchanged.

Telemetry Studio uses separate TPS, adaptive MSPT-envelope and GC lanes; Memory uses heap/committed/cgroup lanes; CPU separates percentages from world counts. Gradients close inside their lane, gaps span the chart, and restart labels are separated. The Performance analyzer retains its five compact synchronized tracks.

All native selects are replaced by the portaled PpSelect listbox, with keyboard navigation, selected state, focus return, status dots and accent swatches. Identity preferences include a real PlayerHead preview.

PlayerHead prioritizes applied texture metadata, uses usernames for offline UUIDs, advances through provider fallbacks, and resets fallback progress when identity or provider changes. The skin proxy accepts bounded UUID/name/texture identities and size parameters, uses fixed HTTPS hosts with redirects rejected, and checks PNG signatures and a 256 KiB response limit within a six-second total timeout.

The companion backend change adds nullable `skinTexture` and `onlineMode` telemetry with compatible constructors. Applied Paper profile metadata is captured on the Bukkit thread, with no synchronous skin API or storage requests. Install the newly built Paper JAR to supply texture metadata; username fallbacks also work with older agents.

Verification commands:

```sh
bash scripts/verify-purge.sh
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:production
npm run verify:structure
```

`structure-qa.mjs` covers all 25 invariants at 1545×911, 1280×800, 1920×1080 and 390×844 in dark and light themes, asserts zero native selects on each route, then exercises persistence, cross-tab updates, stage bounds and open-menu keyboard/accessibility behavior. `polish-qa.mjs` runs the targeted v5.2 interactions independently. Both accept `CHROME_PATH` and `EVIDENCE_DIR`.
