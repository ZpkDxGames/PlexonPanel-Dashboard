# Pre-M2 throwaway experiments

These files are documentation experiments. They are not app routes, production
imports or a font vendor directory. No font binaries are included. M2 has not
started and the maintainer must choose the UI typeface.

Open [gallery.html](gallery.html) for the eight mounted Overview/font comparisons,
the 390/1920 light/dark Pulse overview captures and exact-capture lens examples.
[results.json](results.json) retains the font network traces, CDP rendered faces
and 16 Pulse measurement runs. Each run uses 30 forced redraws, not a production
source schedule. The report is [UI_6_PRE_M2_REVIEW.md](../../UI_6_PRE_M2_REVIEW.md).

From the repository root:

```sh
python docs/ui6-design/review-experiments/contrast.py
npm run relay:build
UI6_EXPERIMENT_FONT_ROOT=/absolute/external/node_modules \
  node docs/ui6-design/review-experiments/run.mjs
```

The external directory must contain `@fontsource-variable/hanken-grotesk@5.3.0`
and `@fontsource-variable/noto-sans@5.3.0`. Reuse an isolated experiment install;
do not add these dependencies or font files to the application. The runner reads
Latin and Latin-extended WOFF2 plus the original unicode ranges, serves them on
loopback and creates signed ephemeral agent fixtures. It starts Next dev on 3000,
the fixture relay on 8788 and the isolated specimen server on 3911. No real
Minecraft/systemd/RCON/Drive integration is contacted. Ports must be free.

For the container fallback engine, set `PLEXON_CHROMIUM_EXECUTABLE` and, when
needed, `LD_LIBRARY_PATH` to the existing native headless shell and libraries.
Otherwise it uses Playwright's installed bundled engine. Do not point Fontconfig
at a config whose font directories do not exist: this was caught in an initial
failed attempt, corrected before the reported experiment. The final run uses the
working system font configuration and validates actual custom-font rendering.

Outputs go to ignored `artifacts/ui6-review/`, including raw traces. Documentation
images and metrics are the reviewed final run; no prior 5.0 evidence is overwritten.
The evidence ZIP includes raw traces and command logs. Prototype inclusion was
checked against the actual production-mode test build manifest/emitted JS. That
check does not satisfy the future M2 kitchen-sink exclusion gate.
