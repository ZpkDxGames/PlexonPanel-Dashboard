import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlotHistoryProvider } from "../src/presentation/PlotHistory";
import { Sparkline } from "../src/components/Telemetry";
import { makeFixture } from "../src/development/fixtures";
test("a passive fleet sparkline never borrows the selected server source history", () => {
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
