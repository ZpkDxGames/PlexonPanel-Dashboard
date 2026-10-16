# Evidence index

All captures are real, labeled localhost fixture browsers with nonlocal requests blocked. No live credential, agent, provider or destructive operation was used.

- `screenshots/baseline/`: 32 before captures from base 4357a66, full page, desktop/mobile dark/light.
- `screenshots/candidate/`: 32 compact after viewport captures for the PR. All candidate full-page, tablet, nested and durable/shared-state PNGs are in the complete owner review archive.
- `screenshot-index.json`: exact source, time, viewport, theme/preferences and image scope for every compact image. Unmasked capture clocks may differ; these are visual review proofs, not a pixel-equality test.
- `reports/matrix.json`: final full 224-case route/nested/preference run at bb1f811. The inherited script's original viewport heights are recorded, not misreported as exact requested heights.
- `reports/widths-final.json`: 128 supplemental cases at the seven exact requested sizes, plus 320×800 large text in both themes. Source 4293d93; includes keyboard skip-to-workspace focus/hash assertions.
- `reports/keyboard-final.json`: source 5ea142d, Player tools/Access segmented selectors and Console tabs; desktop/mobile dark/light. Later selector keyboard changes are nonvisual and separately covered.
- `reports/states.json`: 64 pairing/splash/review/durable-backup/16-instance states at bb1f811. Timed splash axe is explicitly not executed.
- `reports/regressions.json`, `isolation.json`, `action-parity.json`: concrete workflow, cross-source/target and prepared/cancelled exact-target checks. No live mutation was sent.
- `reports/profile-final.json`, `profile-gates.json`: all 30 completed short-replay cases and five-pair gate calculations. Raw interrupted/noisy runs remain in archive diagnostics, not counted as passes.
- `reports/bundle-comparison.json`, `input.json`, `endurance.json`: production gzip bytes, actual-input feedback and sustained bound/teardown evidence. Unsupported throttled-mobile/CLS/native-zoom claims stay blocked; heap is unsupported. The five-pair mixed-source steady gate FAIL is retained in steady-gates.json.
- `logs/`: exact final command output and stage logs identified in VALIDATION.md.

The archive's SHA-256 inventory includes every raw report, image and log. Source/fixture passes do not establish production, physical-device or formal accessibility certification.
