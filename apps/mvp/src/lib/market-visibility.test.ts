import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterMarketSections,
  getMarketListingKind,
  isListingSoldOut,
  isMarketListingEnded,
  isVisibleOnMarket,
} from "./market-visibility";

const NOW = 1_700_000_000;

function auction(overrides: Record<string, unknown> = {}) {
  return {
    status: "ACTIVE",
    listingType: "INDIVIDUAL_AUCTION",
    startTime: "0",
    endTime: "86400",
    hasBid: false,
    bids: [],
    finalized: false,
    totalAvailable: "1",
    totalSold: "0",
    ...overrides,
  };
}

describe("isListingSoldOut", () => {
  it("returns true when all editions sold", () => {
    assert.equal(isListingSoldOut({ totalAvailable: "10", totalSold: "10" }), true);
  });

  it("returns false for partial edition sales", () => {
    assert.equal(isListingSoldOut({ totalAvailable: "10", totalSold: "3" }), false);
  });
});

describe("isVisibleOnMarket", () => {
  it("shows start-on-first-bid auctions with no bids in live mode", () => {
    assert.equal(isVisibleOnMarket(auction(), "live", NOW), true);
    assert.equal(getMarketListingKind(auction(), NOW), "awaiting-bid");
  });

  it("shows partially sold fixed-price listings in live mode", () => {
    const listing = {
      status: "ACTIVE",
      listingType: "FIXED_PRICE",
      startTime: "0",
      endTime: "281474976710655",
      totalAvailable: "5",
      totalSold: "2",
      finalized: false,
    };
    assert.equal(isVisibleOnMarket(listing, "live", NOW), true);
    assert.equal(getMarketListingKind(listing, NOW), "open-sale");
  });

  it("hides sold-out listings in live mode", () => {
    const listing = auction({ totalAvailable: "5", totalSold: "5" });
    assert.equal(isVisibleOnMarket(listing, "live", NOW), false);
    assert.equal(isMarketListingEnded(listing, NOW), true);
  });

  it("hides cancelled listings in all modes", () => {
    const listing = auction({ status: "CANCELLED" });
    assert.equal(isVisibleOnMarket(listing, "live", NOW), false);
    assert.equal(isVisibleOnMarket(listing, "include-ended", NOW), false);
  });

  it("shows concluded listings only in include-ended mode", () => {
    const listing = auction({
      startTime: String(NOW - 10_000),
      endTime: String(NOW - 100),
      hasBid: true,
      bids: [{ id: "1", bidder: "0x1", amount: "1", timestamp: "1" }],
    });
    assert.equal(isVisibleOnMarket(listing, "live", NOW), false);
    assert.equal(isVisibleOnMarket(listing, "include-ended", NOW), true);
  });

  it("shows scheduled future auctions in live mode", () => {
    const listing = auction({
      startTime: String(NOW + 3600),
      endTime: String(NOW + 7200),
    });
    assert.equal(isVisibleOnMarket(listing, "live", NOW), true);
    assert.equal(getMarketListingKind(listing, NOW), "scheduled");
  });

  it("hides start-on-first-bid auctions whose duration has elapsed", () => {
    const listing = auction({
      startTime: "0",
      endTime: "86400",
      hasBid: true,
      bids: [
        {
          id: "1",
          bidder: "0x1",
          amount: "1",
          timestamp: String(NOW - 200_000),
        },
      ],
    });
    assert.equal(isMarketListingEnded(listing, NOW), true);
    assert.equal(isVisibleOnMarket(listing, "live", NOW), false);
    assert.equal(isVisibleOnMarket(listing, "include-ended", NOW), true);
  });

  it("keeps start-on-first-bid auctions live while duration remains", () => {
    const listing = auction({
      startTime: "0",
      endTime: "86400",
      hasBid: true,
      bids: [
        {
          id: "1",
          bidder: "0x1",
          amount: "1",
          timestamp: String(NOW - 3_600),
        },
      ],
    });
    assert.equal(isVisibleOnMarket(listing, "live", NOW), true);
  });

  it("drops ended lots from live rails but keeps them when include-ended is on", () => {
    const live = auction({ listingId: "1" });
    const ended = auction({
      listingId: "2",
      status: "FINALIZED",
      finalized: true,
    });
    const sections = [
      { id: "live", listings: [live] },
      { id: "done", listings: [ended] },
    ];
    assert.deepEqual(
      filterMarketSections(sections, "live").map((s) => s.id),
      ["live"]
    );
    assert.equal(filterMarketSections(sections, "include-ended").length, 2);
  });
});
