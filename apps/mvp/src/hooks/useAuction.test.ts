import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowAuctionPageLoading } from "./useAuction";

describe("shouldShowAuctionPageLoading", () => {
  it("shows loading only on initial fetch before auction data exists", () => {
    assert.equal(shouldShowAuctionPageLoading(true, false), true);
    assert.equal(shouldShowAuctionPageLoading(false, false), false);
  });

  it("never blanks the page during silent background refresh", () => {
    assert.equal(shouldShowAuctionPageLoading(true, true), false);
    assert.equal(shouldShowAuctionPageLoading(false, true), false);
  });
});
