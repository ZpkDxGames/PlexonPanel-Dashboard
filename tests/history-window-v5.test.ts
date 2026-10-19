import test from "node:test";
import assert from "node:assert/strict";
import {
  historyWindow,
  retainHistoryPage,
} from "../src/ui/console/history-window";
const id = (n: number) => String(n),
  at = (n: number) => n;
test("older cursor pages remain chronological and visible despite a full live buffer", () => {
  const live = Array.from({ length: 500 }, (_, i) => i + 100);
  assert.deepEqual(
    historyWindow([99, 98], [98, 96, 97], live, true, 4, id, at),
    [96, 97, 98, 99],
  );
  assert.deepEqual(
    historyWindow([], [598, 599], live, false, 4, id, at),
    [596, 597, 598, 599],
  );
});
test("cursor accumulation stays bounded while moving to earlier history and never mutates inputs", () => {
  let older: number[] = [];
  const page = [10, 9, 8],
    copy = [...page];
  older = retainHistoryPage(older, page, 4);
  older = retainHistoryPage(older, [7, 6, 5], 4);
  assert.equal(older.length, 4);
  assert.deepEqual(older, [8, 7, 6, 5]);
  assert.deepEqual(
    historyWindow(older, [4, 3], [], true, 4, id, at),
    [3, 4, 5, 6],
  );
  assert.deepEqual(page, copy);
});
