# Owner visual rebuild directive — 2026-10-18

The owner explicitly rejected the previously deployed Strata-derived appearance. This directive and the current owner message supersede visual constraints in the historical master directive, including its two-tier top bar, source accordions and chart-first Overview.

Required outcome:

- Delete `src/styles.css`, `src/styles/**`, `src/components/nextgen/**`, `src/components/Shell.tsx`, `src/components/ui.tsx`, `src/components/charts/TimeSeries.tsx`, `docs/next-gen/**`, and `scripts/nextgen-*.mjs`.
- Keep Protocol 3, headless authority/state/presentation logic, pairing and reviewed mutation contracts.
- Use real Tailwind CSS, Radix/shadcn-style primitives, lucide-react, Recharts, and TanStack Virtual in Next App Router.
- Use a 240px collapsible left sidebar with a server switcher and Monitoring / Management / System groups. Use a compact source-health popover instead of source accordions.
- Overview starts with the selected server, live status, Start / Restart / Stop, then Tick Performance / Online Players / Compute Load / Memory Allocation cards, visible above the fold.
- Overview has one 360px Recharts plot selected through Tick & MSPT / Memory Tiers / CPU & Chunks tabs. Use gradient fills, floating hover tooltips and adequately padded axes.
- Remove the unavailable-session console box. Render one timestamp/level column, stripping only recognized duplicate leading metadata in the display. Integrate the reviewed command composer into the bottom of the console.
- Rebuild all eight operational views using the new component system; retain truthful missing/denied/offline behavior, exact identities, current boot boundaries, and zero operational browser persistence.

Source baseline: dashboard main `9c302a5d1f3071297ab773e9f6144ed6980c4346`. Backend main `24ea336cc0f6ce04fd47dfa4b2b2ba54ee9fb206` is unchanged by this visual work. Existing owner merge/deployment authorization in this conversation remains applicable.
