import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlainDurationSecondsString } from "./create-listing-endtime";

describe("isPlainDurationSecondsString", () => {
  it("rejects datetime-local values (parseInt would read only the year)", () => {
    assert.equal(isPlainDurationSecondsString("2026-05-04T07:33"), false);
    assert.equal(isPlainDurationSecondsString("2026-05-04T07:00"), false);
  });

  it("accepts digit-only duration seconds from DurationSelector", () => {
    assert.equal(isPlainDurationSecondsString("604800"), true);
    assert.equal(isPlainDurationSecondsString(" 86400 "), true);
  });

  it("rejects empty and non-positive", () => {
    assert.equal(isPlainDurationSecondsString(""), false);
    assert.equal(isPlainDurationSecondsString("0"), false);
  });
});
