import assert from "node:assert/strict";
import test from "node:test";
import { SlidingWindowRateLimiter } from "../dist/rate-limit.js";

test("sliding window enforces and then releases its limit", () => {
  const limiter = new SlidingWindowRateLimiter(2, 1_000);

  assert.equal(limiter.consume("client", 1_000), true);
  assert.equal(limiter.consume("client", 1_100), true);
  assert.equal(limiter.consume("client", 1_200), false);
  assert.equal(limiter.consume("client", 2_101), true);
});
