# Performance comparison

Measurements are project gates on synthetic local input, not live agent latency or hardware certification. Baseline and candidate use the same Node 24.19.0, locked packages, Firefox 157.0, 1440×900 viewport, motion off and skins disabled. Runs are sequential with no other browser workload during profiling. Both are Vite development builds for frame measurement; production bundle bytes are measured separately using Node zlib defaults.

**P7 disposition: BLOCKED.** The short-replay and bundle gates pass. The supplementary five-pair mixed-source steady Focus comparison fails and needs further investigation/optimization before review readiness. CPU-throttled mobile, instrumented CLS and native 200% zoom are also blocked by this environment.

## Short replay: all five paired trials

Baseline source: `4357a66bc674fddce7432cbc27a4fead00ac8234`. Candidate chart/Overview source: `41900d5e9de51d2220c6db7b60b8afd50d036768`. Later product commits improve Backups visibility/availability, skip-link focus and Players/Access keyboard interactions. The chart/Overview/Performance implementations are identical to the measured candidate. The sustained run uses final product `5ea142df03d9c0978887be95a56f4ab724f1489b`; final build identity is recorded in the bundle report.

The workload seeds 8,192 raw observations and 2,500 console lines, then delivers 24 Paper telemetry events with 125ms requested spacing. Overview mounts two main plots, focus one and comparison all eight; no track was hidden to improve the result. Browser visibility was visible/focused and hidden-frame counts were zero. The statistic is the median of all five per-trial p95 requestAnimationFrame intervals.

| Mode | Baseline median p95 | Candidate median p95 | Project limit | Result |
| --- | ---: | ---: | ---: | --- |
| Overview (2 plots) | 17.30 ms | 33.20 ms | 40.00 ms | PASS |
| Focus (1 plot) | 17.20 ms | 17.20 ms | 25.00 ms | PASS |
| Compare (8 plots) | 50.42 ms | 50.44 ms | 83.50 ms | PASS |

Overview increased 91.9% against the newly measured baseline median while remaining below the specified practical 40ms ceiling. Compare increased 0.04%; focus is essentially unchanged. These are not universal 60fps claims. Candidate compare p95 trials range 33.38–83.46ms; Overview baseline varies 17.22–33.24ms. Variation exceeded 25%, so five paired trials were retained rather than selecting a fast run. Raw observations, per-trial DOM/path/sample/console counts and exact source identities are in `profile-final.json` and `profile-gates.json`.

Earlier pre-resumption profiles had much higher variance; one five-trial process was interrupted after 29/30 cases. Those raw reports are retained under diagnostics and are not counted as a completed gate. Browser focus/load was investigated, source worktrees were separated, and the final complete five-pair set was run after the resumed pinned-browser restore. No speedup is attributed causally to this environment change. The chart formatting refinement reuses Intl.NumberFormat instances and Overview's eligible health projection without changing any sample, clock, gap, extrema or retention rule.

## Production bundle, retained bounds and input

Production build source: `5ea142df03d9c0978887be95a56f4ab724f1489b`. All three production byte budgets PASS. No dependency/lockfile/font-family change or decorative raster payload was added. The original block mark is inline SVG and is accounted for in JS.

| Measure | Baseline | Candidate | Limit |
| --- | ---: | ---: | ---: |
| Initial JS gzip | 89,808 B | 90,043 B | 104,448 B |
| All JS gzip | 125,911 B | 130,182 B | 148,480 B |
| CSS gzip | 20,666 B | 21,776 B | 24,576 B |

Compression is `node:zlib gzipSync` defaults; Vite's terminal estimate is not mixed into the comparison. The candidate adds 235 B initial JS, 4,271 B total JS and 1,110 B CSS against the clean base.

| Short replay median DOM / console | Baseline | Candidate |
| --- | ---: | ---: |
| Overview DOM nodes | 889 | 899 |
| Focus DOM nodes | 593 | 606 |
| Compare DOM nodes | 962 | 989 |
| Console nowrap rendered rows | 26 | 20 |
| Console wrap rendered rows | 400 | 400 |
| Raw observations retained | 8,192 | 8,192 |

Input uses actual Playwright fill events and verifies the visible matching roster, followed by two animation-frame callbacks. It includes automation overhead. Each viewport has 24 input samples and 24 warmed route transitions. Desktop input p95 is **42ms** (≤100ms); mobile-sized unthrottled Firefox is **48ms**. Warm route p95 is **73ms desktop / 84ms mobile-sized** (≤200ms). Mobile figures are explicitly unthrottled and do not satisfy the CPU-throttled gate.

## Sustained workload and teardown

Both final product/base sessions completed 600 measured seconds with 8,192 raw observations, 2,500 console lines, 24 players and three worlds. Each switched to four new exact synthetic server IDs and repeatedly changed routes. No-wrap rows stayed within the measured viewport + overscan limit. Both unmounted to zero chart/terminal nodes, then closed the fixture session/context. Baseline final Settings DOM count was 341; candidate was 352. This proves the measured bounds and route DOM cleanup, not zero heap growth or live socket acceptance.

The first 60 seconds use mixed input: Paper health every requested 125ms, plus Paper system, Host system and console every fourth frame. Actual ten-minute event counts were 4,425 baseline and 4,036 candidate; the timer waits after processing, so nominal 8Hz is not advertised as achieved throughput. First-pair steady p95 was 33.34ms baseline versus 50.48ms candidate (+51.4%). It is disclosed independently of the passing Paper-health-only short gate.

A 120-event instrumented React Profiler diagnostic measured 33.40ms frame p95 for both versions. App mean React duration was 16.88ms baseline /15.80ms candidate; chart mean 2.37/1.80ms. This does not identify a consistent chart-render regression and is not substituted for uninstrumented acceptance. All five uninstrumented 60-second pairs are retained below. The first pair is the first 60 seconds of each ten-minute session; the other four use the identical mixed-input first-minute workload. The supplementary sustained check applies the same Focus formula, max(25ms, 1.10×baseline median).

| Pair | Baseline p95 | Candidate p95 |
| --- | ---: | ---: |
| 1 | 33.34 ms | 50.48 ms |
| 2 | 33.46 ms | 49.54 ms |
| 3 | 33.30 ms | 34.18 ms |
| 4 | 33.32 ms | 49.82 ms |
| 5 | 33.36 ms | 33.46 ms |
| **Median** | **33.34 ms** | **49.54 ms** |

**FAIL: 49.54ms > 36.674ms**, +48.6% versus the baseline median. The variation is real in these observations; the faster instrumented diagnostic is not a replacement. No source/cadence/retention/track reduction was used to force a pass. This prevents a review-ready claim. Remaining work is a browser CPU/style/paint investigation and a justified presentation optimization, followed by complete paired remeasurement. The React diagnostic alone does not establish the root cause.


Firefox does not expose CDP CPU throttling or layout-shift entries. Pinned Chromium and headless-shell downloads both failed with invalid/truncated archives. Therefore CPU-throttled mobile input and browser CLS certification are BLOCKED in this environment. Unthrottled Firefox input is reported with its own scope, never substituted for throttled-mobile acceptance. Native 200% browser zoom is BLOCKED: the real Control+= shortcut did not produce a verified doubled DPR/halved CSS viewport in headless Firefox. Viewport, CSS zoom or deviceScaleFactor changes are not labeled native zoom.

Heap measurement is unsupported in Firefox. The sustained test reports actual raw bounds, mounted DOM/virtual rows, repeated target/route switches and teardown counts instead of claiming zero memory growth. The display-path microbenchmark is separate and excludes React, browser painting and transport. No browser frame statistic is presented as wire/capture-to-receipt latency.
