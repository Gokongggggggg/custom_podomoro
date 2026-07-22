import test from "node:test";
import assert from "node:assert/strict";
import { calculateRecoveryMinutes, formatClock, recoveryActivity } from "./recovery.js";

test("recovery scales at twenty percent", () => {
  assert.equal(calculateRecoveryMinutes(25 * 60_000), 5);
  assert.equal(calculateRecoveryMinutes(60 * 60_000), 12);
  assert.equal(calculateRecoveryMinutes(90 * 60_000), 18);
  assert.equal(calculateRecoveryMinutes(120 * 60_000), 24);
});

test("recovery is bounded", () => {
  assert.equal(calculateRecoveryMinutes(0), 3);
  assert.equal(calculateRecoveryMinutes(4 * 60_000), 3);
  assert.equal(calculateRecoveryMinutes(5 * 60 * 60_000), 30);
});

test("clock formatting handles hours", () => {
  assert.equal(formatClock(65_000), "01:05");
  assert.equal(formatClock(3_665_000), "01:01:05");
  assert.equal(formatClock(-1), "00:00");
});

test("long sessions get a stronger movement prompt", () => {
  assert.match(recoveryActivity(95 * 60_000), /walk/);
});
