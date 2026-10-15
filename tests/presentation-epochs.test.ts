import test from "node:test";
import assert from "node:assert/strict";
import { SourceEpochs } from "../src/presentation/epochs";
import { makeFixture } from "../src/development/fixtures";
test("source generation changes invalidate only their plot history, preserving raw history and other authorities", () => {
  const state = makeFixture(),
    epochs = new SourceEpochs(),
    original = state.history;
  epochs.update(state, 1);
  assert.equal(epochs.view(original, "hostSystem"), original);
  state.ready!.server.hostSession = "next-host";
  epochs.update(state, 1);
  assert.equal(epochs.view(original, "hostSystem").length, 0);
  assert.equal(epochs.view(original, "service").length, 0);
  assert.equal(epochs.view(original, "paperHealth"), original);
  assert.equal(state.history, original);
  const added = { ...original.at(-1)!, at: original.at(-1)!.at + 1000 };
  const next = [...original, added];
  assert.deepEqual(epochs.view(next, "hostSystem"), [added]);
  assert.equal(
    epochs.view(next, "hostSystem"),
    epochs.view(next, "hostSystem"),
  );
  epochs.update(state, 2);
  assert.equal(epochs.view(next, "hostSystem"), next);
});
test("legacy source offline/online boundaries also invalidate charts without inventing time cutoffs", () => {
  const state = makeFixture(),
    epochs = new SourceEpochs();
  delete state.ready!.server.hostSession;
  epochs.update(state, 1);
  state.ready!.agents.host = false;
  epochs.update(state, 1);
  assert.equal(epochs.view(state.history, "hostSystem").length, 0);
  state.ready!.agents.host = true;
  epochs.update(state, 1);
  assert.equal(epochs.view(state.history, "hostSystem").length, 0);
});
