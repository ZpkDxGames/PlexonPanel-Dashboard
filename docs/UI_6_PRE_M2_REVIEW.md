# Conditional M1 acceptance — pre-M2 review

2026-10-08 UTC. Branch `release/6.0.0`; production anchor `86b6a0cefb2c5e420c9c862a7897705e1ea59146`. This is the requested review checkpoint, **not M2**. No production UI, font assets, app routes, dependencies, tests, transport or protocol changes. [Comparison gallery](ui6-design/review-experiments/gallery.html) contains all requested images; [raw results](ui6-design/review-experiments/results.json) records measurements and rendered font identities.

## 1. M0 reconciled against original evidence

[UI_6_BASELINE.md](UI_6_BASELINE.md) now separates execution, source review and acceptance. All **120 original PNG hashes** matched; all 15 pages × light/dark × 390/768/1280/1920 have an original capture and axe entry. The baseline includes a result per combination, not “same four” shorthand. Capture and axe-execution gates passed. Zero-serious/critical acceptance **failed**: Fleet `definition-list` in all eight combinations; other 112 configured scans found zero violations. This defect has not been fixed.

The 228-declaration per-control authorization/confirmation audit and 15 × 8 state inventory are complete **source reviews**. Exhaustive mounted authorization permutations and the full loading/stale/disconnected/degraded/forbidden/busy/error browser matrix are **not executed**. Dedicated states missing in current code are enumerated in [UI_6_STATE_MATRIX.md](UI_6_STATE_MATRIX.md), with implementation proofs in [UI_6_TEST_GAPS.md](UI_6_TEST_GAPS.md). Screen-reader, keyboard flow, zoom, performance soak and live infrastructure acceptance remain **not executed**. “Interrupted checkpoint” is not the current status: discovery evidence is complete, and failed/missing acceptance work is named explicitly rather than promoted to passed.

## 2. Tokens corrected and recalculated

Both malformed `#B 7C3CB` entries are corrected to `#B7C3CB`. Markdown cell padding, joined numbers and prose spacing are normalized. The recalculation reads canonical [tokens.json](ui6-design/tokens.json) directly and asserts all **19** Markdown color/accent rows match both themes. It does not regenerate or silently alter input tokens.

Command: `python docs/ui6-design/review-experiments/contrast.py`. **134/134 required opaque pairs passed**; minimum text/status/interaction ratio **5.1362:1**; minimum essential boundary **3.8763:1**. Eight quiet decorative-border pairs remain unsuitable for essential boundaries/text. No rendered-product WCAG certification or new composite-color approval is implied.

## 3. Typeface reopened: Hanken Grotesk recommended

The previous full Extended-B gate was unnecessary. Portuguese and English are the requirement, with fallback for uncommon name glyphs. Eight actual browser captures compare **Hanken Grotesk and Noto Sans**, each at **390/1280 px × light/dark**. They use the real mounted, unchanged 5.0 Overview topbar/page header and its copy, with a fixture-only Pulse inserted by automation. They are not a shipped 6.0 shell mock or a complete six-instrument layout. Fixture metrics are clearly labelled. CDP rendered-font inspection confirms each header and Portuguese specimen uses the requested custom face without fallback. No root horizontal overflow in the comparison captures.

At 390 px, Hanken's fixture explanation fits one line where Noto needs two; its Portuguese sentence also uses less width. Both keep accents/counters and tabular values legible. At 1280 px both work; Hanken's stronger compact headings suit the instrument concept. **Recommend Hanken Grotesk with the proposed Commit Mono, pending your choice.** This is a layout judgement, not a user readability study or font performance victory: normal Latin byte sizes differ by only 1,116 bytes.

| Candidate | Normal Latin WOFF2 | Optional Latin-extended | Total if both requested |
|---|---|---|---|
| Hanken Grotesk | 34,704 bytes | 19,588 bytes | 54,292 bytes |
| Noto Sans | 35,820 bytes | 167,960 bytes | 203,780 bytes |

Cold-cache tests disable HTTP cache and use unique URLs. The experiment serves existing external font files without copying them into the repository. Results for **both** candidates:

- English and precomposed Portuguese specimen: exactly one Latin request; **zero Latin-extended requests**.
- Add `João_Łukasz`: the extended request occurs and the custom face renders it.
- Add `Ж`: the system DejaVu Sans fallback renders that rare Cyrillic glyph; no claim of universal language coverage.
- Negative control, preload the extended face without extended text: it downloads immediately.

Thus unicode-range loading is **verified on demand in this Chromium experiment only when extended is not preloaded**. This agrees with the [MDN descriptor documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/unicode-range). The normal cold Noto cost is 35,820 bytes, not automatically the combined 203,780 bytes previously emphasized. Decomposed Unicode/other scripts and every operating system fallback are **not executed** in this review.

Installed Next 16.3.8 docs and local-font loader were inspected: local preload defaults to true; all `src` entries inherit that option; custom declarations apply to all emitted faces. A naive two-source `next/font/local` call does **not** automatically preserve the Fontsource per-subset ranges or defer the larger subset. M2 must generate separate range-qualified faces and keep the extended face out of preload, then verify production-emitted CSS and cold network traces. That Next integration is **not executed**. **No fonts have been vendored.**

## 4. Tick Pulse throwaway prototype

The prototype is served by its own loopback Node HTTP server. It is not a Next page, has no app import, production entry point, signed operation or extra telemetry store. Fixture-only values remain labelled. A temporary browser insertion into the mounted header is also automation-only; no production route was edited. Source, CSS and HTML are under `docs/ui6-design/review-experiments/`; original baseline evidence is untouched.

Thirty-minute datasets: 900 nominal two-second slots minus 30 missing captures = **870 real fixture captures**; dense stress dataset = **8,192 retained captures** with actual timestamps excluding a one-minute outage. Both include a real zero, unavailable MSPT, degraded/critical TPS, and one **140 ms** overflow capture. Geometry draws one bar subpath per capture, with grouped status paths, no sample thinning, interpolation or fabricated missing slots. A captured zero is a baseline mark; unknown MSPT and absent time are hatched. The exact spike value is recoverable by keyboard/pointer and the one-minute lens. A paged table retains all captures (100/page; 9 or 82 pages).

Executed: 390/1920 px × light/dark × normal/dense; each at normal CPU and **4× CDP main-thread throttling**, 30 forced redraws after five warmups. Eight overview images plus eight lens images; keyboard Home/Right and opening the lens/table checked. SVG inner nodes remain **12** for either dataset; path text grows from about 30–32 kB to 286–302 kB. This bounds DOM, not raster cost.

| Viewport px | Captures | CPU throttle | Geometry p95 ms | Submit + forced geometry flush p95 ms | Trace Paint work/redraw ms | Trace RasterTask work/redraw ms |
|---|---|---|---|---|---|---|
| 390 | 870 | 1× | 0.40–0.60 | 1.70–2.50 | 0.23–0.23 | 3.88–4.52 |
| 390 | 870 | 4× | 2.00–2.10 | 5.70–6.20 | 1.01–1.20 | 4.08–4.41 |
| 390 | 8,192 | 1× | 4.00–4.60 | 5.60–6.20 | 0.22–0.29 | 40.47–41.64 |
| 390 | 8,192 | 4× | 17.80–22.30 | 24.40–29.00 | 1.08–1.09 | 41.67–43.28 |
| 1920 | 870 | 1× | 0.40–0.60 | 1.20–1.40 | 0.19–0.25 | 4.74–5.07 |
| 1920 | 870 | 4× | 2.40–2.60 | 6.50–6.60 | 0.91–1.31 | 4.79–4.96 |
| 1920 | 8,192 | 1× | 3.10–4.70 | 4.30–8.20 | 0.21–0.22 | 54.93–57.26 |
| 1920 | 8,192 | 4× | 16.30–18.40 | 24.30–25.30 | 0.89–1.30 | 57.08–57.08 |

Ranges span the two themes. Geometry includes current-metric text updates; flush invokes SVG getBBox after attribute submission. Paint/raster figures divide total traced work by 30 and include warmup/inspection overhead; they are **CPU-work indicators, not per-frame wall latency or FPS**. Raster work can run across workers, and CDP CPU throttling does not emulate an actual phone GPU/processor. The forced consecutive redraw schedule is a stress test, not the normal two-second capture schedule. A mobile/dark/dense/4× trace contains one **131.57 ms Chrome_InProcRendererThread RunTask**; the browser Long Tasks observer returned no entries for that run, so we retain both facts and do not declare the 100 ms steady-state product gate passed. Production React integration, input latency, full-history clocks/off-screen behavior, LCP/CLS/INP and a physical phone remain **not executed**.

### Readability and fallback proposal

At 390 px the plot is 332 px wide: two-second captures are about **0.37 CSS px apart**, and the dense dataset is about **0.04 px apart**. At 1920 px, the plot uses the planned max-width and is 1,558 px wide: normal captures are about **1.73 px apart**, dense about **0.18–0.19 px**. DPR=1 was tested; higher DPR and 200% zoom are not executed. The outage and broad lag region remain apparent at both widths, but isolated captures cannot be independently read at mobile density; the cap case fails individual readability on desktop too. Subpixel antialiasing blends samples and a tiny individual spike requires explicit inspection.

**One mark per capture holds as a data/geometry contract; it does not hold as a readable, efficient 30-minute presentation across all widths/cadences.** Normal desktop succeeds as a quick instrument; mobile normal and both cap cases need another inspection scale. A small DOM alone does not justify the full dense path.

Recommended fallback, requiring approval before changing the design rule:

1. Keep all retained captures and use an exact-capture lens plus table for inspection; the tested one-minute lens makes the 140 ms spike and nearby captures readable even at the retention cap.
2. Use raw marks in windows with at least one CSS px of capture separation. Choose a shorter local inspection window when necessary, explicitly labelled; retain the selected 30-minute observed/report window and its complete table.
3. For a dense 30-minute overview, use a pixel-bounded **aggregated** summary, explicitly labelled as such: worst observed TPS category, observed MSPT min/max, exact count and interval, unknown coverage; split at true gaps and never smooth/interpolate or report a synthetic capture. Keep exact raw values in lens/table. This intentionally changes “one mark per capture” for the summary and is **proposed, not implemented or approved**. Bound raster path work by plot pixels. Do not silently reuse ordinary chart thinning while claiming raw marks.

The lower-risk alternative is to retain the raw 30-minute strip as a non-individual overview and require a lens/table, but it retains the measured raster cost at high cadence. It should not be chosen without further renderer work and product performance evidence.

## Stop boundary and next authorized scope

M2 is **not started**. After the maintainer's font/rendering reply, its initial scope is tokens and CSS layers, chosen vendored fonts, theme switching, primitives, icon set and a dev-only kitchen-sink page whose exclusion from the production build is actually checked. The current prototype is documentation-only; it does not satisfy that future kitchen-sink gate.

## Validation

| Gate | Result |
|---|---|
| Original 120 PNG hashes and complete screenshot/axe combinations | Passed reconciliation; existing Fleet axe cleanliness failed |
| Control audit/state matrix | Passed source inventory; exhaustive mounted/state execution not executed |
| Markdown/token equivalence and fresh contrast calculation | Passed: 19 matching rows; 134 required pairs |
| Eight actual mounted header/font captures and CDP font identity | Passed |
| Unicode-range on-demand and explicit-preload negative controls | Passed for both candidate fonts in native Chromium 153 |
| Pulse capture count, 390/1920 light/dark, keyboard/lens/table experiment | Executed; dense readability fails as described |
| Production fonts/Pulse/kitchen-sink integration and product performance | Not executed |
| Full manual accessibility / unchanged browser regression / live certification | Not executed |
| End checkpoint npm run check | Passed: exit 0; 79 relay + 183 dashboard tests, zero failures/skips; production-mode test build executed |
| Current throwaway prototype exclusion | Passed: no prototype route in production app manifest and no PulseExperiment/pulse-specimen/__ui6-review markers in emitted app/chunk JS; future kitchen-sink gate not executed |
