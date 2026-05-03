import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectCandidateAddresses,
  sellerMatchesCandidates,
} from "./listing-theme-candidates";

describe("collectCandidateAddresses", () => {
  it("normalizes and dedupes", () => {
    const c = collectCandidateAddresses("0xABCDEF0123456789ABCDEF0123456789ABCDEF01", [
      "0xabcdef0123456789abcdef0123456789abcdef01",
      "not-an-address",
      "0x1111111111111111111111111111111111111111",
    ]);
    assert.equal(c.length, 2);
    assert.ok(c.includes("0xabcdef0123456789abcdef0123456789abcdef01"));
    assert.ok(c.includes("0x1111111111111111111111111111111111111111"));
  });
});

describe("sellerMatchesCandidates", () => {
  it("returns true when seller in list", () => {
    assert.equal(
      sellerMatchesCandidates("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ]),
      true
    );
  });
  it("returns false otherwise", () => {
    assert.equal(
      sellerMatchesCandidates("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ]),
      false
    );
  });
});
