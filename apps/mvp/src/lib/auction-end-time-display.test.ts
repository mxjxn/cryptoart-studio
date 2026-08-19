import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  earliestBidUnixSeconds,
  resolveStartedAuctionEndTime,
} from "./time-utils";

describe("resolveStartedAuctionEndTime", () => {
  it("prefers absolute endTime from contract over subgraph duration", () => {
    const resolved = resolveStartedAuctionEndTime({
      subgraphEndTime: 604800,
      contractEndTime: 1_800_000_000,
      contractStartTime: 1_799_395_200,
      firstBidTimestamp: "1799395300",
      now: 1_799_395_400,
    });

    assert.equal(resolved, 1_800_000_000);
  });

  it("falls back to contract startTime plus duration when contract endTime is not loaded yet", () => {
    const resolved = resolveStartedAuctionEndTime({
      subgraphEndTime: 604800,
      contractEndTime: null,
      contractStartTime: 1_700_000_000,
      firstBidTimestamp: "1700001000",
      now: 1_700_000_500,
    });

    assert.equal(resolved, 1_700_604_800);
  });

  it("uses the first bid plus duration, not the highest bid, when contract times are missing", () => {
    // eth/6: 24h duration, first bid 1787004887, later high bid 1787069363
    const resolved = resolveStartedAuctionEndTime({
      subgraphEndTime: 86400,
      contractEndTime: null,
      contractStartTime: null,
      firstBidTimestamp: "1787004887",
      highestBidTimestamp: "1787069363",
      now: 1_787_149_000,
    });

    assert.equal(resolved, 1787004887 + 86400);
  });
});

describe("earliestBidUnixSeconds", () => {
  it("returns the minimum timestamp regardless of amount-desc order", () => {
    const earliest = earliestBidUnixSeconds([
      { timestamp: "1787069363" },
      { timestamp: "1787053463" },
      { timestamp: "1787004887" },
    ]);
    assert.equal(earliest, 1787004887);
  });
});
