import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlotHistoryProvider } from "../src/presentation/PlotHistory";
import { usePlotHistory } from "../src/presentation/PlotHistory";
import { chartRows } from "../src/presentation/recharts-data";
import type { Sample } from "../src/adapter/control-state";
function Sparkline({ samples }: { samples: Sample[]; metric: string }) {
  const epochs = usePlotHistory(samples);
  return createElement(
    "pre",
    null,
    JSON.stringify(
      chartRows(epochs?.paperHealth ?? samples, "paperHealth", ["tps"], 0),
    ),
  );
}
import { makeFixture } from "../src/development/fixtures";
test("a passive fleet chart never borrows the selected server source history", () => {
  const selected = makeFixture(),
    other = makeFixture();
  other.history = other.history.map((s, i) => ({
    ...s,
    tps: 10 + Math.sin(i / 5) * 2,
  }));
  const standalone = renderToStaticMarkup(
    createElement(Sparkline, { samples: other.history, metric: "tps" }),
  );
  const nested = renderToStaticMarkup(
    createElement(PlotHistoryProvider, {
      state: selected,
      revision: 1,
      children: createElement(Sparkline, {
        samples: other.history,
        metric: "tps",
      }),
    }),
  );
  const selectedPlot = renderToStaticMarkup(
    createElement(Sparkline, { samples: selected.history, metric: "tps" }),
  );
  assert.equal(nested, standalone);
  assert.notEqual(nested, selectedPlot);
});
