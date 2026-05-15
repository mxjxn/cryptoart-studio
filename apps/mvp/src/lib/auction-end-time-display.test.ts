import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStartedAuctionEndTime } from "./time-utils";

describe("resolveStartedAuctionEndTime", () => {
  it("prefers absolute endTime from contract over subgraph duration", () => {
    const resolved = resolveStartedAuctionEndTime({
      subgraphEndTime: 604800,
      contractEndTime: 1_800_000_000,
      contractStartTime: 1_799_395_200,
      highestBidTimestamp: "1799395300",
      now: 1_799_395_400,
    });

    assert.equal(resolved, 1_800_000_000);
  });

  it("falls back to contract startTime plus duration when contract endTime is not loaded yet", () => {
    const resolved = resolveStartedAuctionEndTime({
      subgraphEndTime: 604800,
      contractEndTime: null,
      contractStartTime: 1_700_000_000,
      highestBidTimestamp: "1700001000",
      now: 1_700_000_500,
    });

    assert.equal(resolved, 1_700_604_800);
  });
});
