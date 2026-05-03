import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBiddingWindowAfterStart,
  formatCountdownTo,
  formatPreOpenAuctionTiming,
  getAuctionTimeStatus,
} from "./time-utils";

describe("getAuctionTimeStatus (fixed startTime)", () => {
  it("uses starts-in before open, ends-in after open", () => {
    const now = 1_000_000;
    const startTime = now + 9 * 3600;
    const endTime = startTime + 24 * 3600;
    const before = getAuctionTimeStatus(startTime, endTime, false, now);
    assert.equal(before.status, "Not started");
    assert.match(before.timeRemaining ?? "", /^starts in /);
    assert.match(before.timeRemaining ?? "", / · ends in /);
    assert.match(before.timeRemaining ?? "", / · bidding /);

    const afterOpen = getAuctionTimeStatus(startTime, endTime, false, startTime + 60);
    assert.equal(afterOpen.status, "Live");
    assert.match(afterOpen.timeRemaining ?? "", /^ends in /);
  });
});

describe("formatBiddingWindowAfterStart", () => {
  it("formats sub-hour windows", () => {
    const start = 1_700_000_000;
    assert.equal(formatBiddingWindowAfterStart(start, start + 2026), "bidding 33m");
  });
});

describe("formatPreOpenAuctionTiming", () => {
  it("includes bidding span", () => {
    const now = 500;
    const start = now + 7200;
    const end = start + 90 * 60;
    const t = formatPreOpenAuctionTiming(start, end, now);
    assert.ok(t.includes("starts in 2 hrs"));
    assert.ok(t.includes("ends in"));
    assert.ok(t.includes("bidding 1 hr 30m"));
  });
});

describe("formatCountdownTo", () => {
  it("labels starts vs ends", () => {
    const now = 500;
    const target = now + 7200;
    assert.equal(formatCountdownTo(target, now, "starts"), "starts in 2 hrs");
    assert.equal(formatCountdownTo(target, now, "ends"), "ends in 2 hrs");
  });
});
