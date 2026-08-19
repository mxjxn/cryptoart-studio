import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getExplorerAddressUrl,
  getExplorerChainLabel,
  getExplorerNftUrl,
  getOpenSeaItemUrl,
  isPresentTokenId,
} from "./utils";

const NFT = "0xCEFC0F50336d3eBF055cDf4308d0661e2E4674B0";

describe("isPresentTokenId", () => {
  it("keeps token id 0", () => {
    assert.equal(isPresentTokenId(0), true);
    assert.equal(isPresentTokenId("0"), true);
  });

  it("rejects missing ids", () => {
    assert.equal(isPresentTokenId(undefined), false);
    assert.equal(isPresentTokenId(null), false);
    assert.equal(isPresentTokenId(""), false);
  });
});

describe("explorer urls", () => {
  it("sends Ethereum contracts to Etherscan, not BaseScan", () => {
    assert.equal(
      getExplorerAddressUrl(NFT, 1),
      `https://etherscan.io/address/${NFT}`
    );
    assert.equal(
      getExplorerNftUrl(NFT, "1", 1),
      `https://etherscan.io/nft/${NFT}/1`
    );
    assert.equal(getExplorerChainLabel(1), "Ethereum");
  });

  it("defaults omitted chainId to Base", () => {
    assert.equal(
      getExplorerAddressUrl(NFT),
      `https://basescan.org/address/${NFT}`
    );
    assert.equal(
      getExplorerNftUrl(NFT, 1, 8453),
      `https://basescan.org/nft/${NFT}/1`
    );
  });

  it("builds chain-specific OpenSea item urls", () => {
    assert.equal(
      getOpenSeaItemUrl(NFT, "1", 1),
      `https://opensea.io/item/ethereum/${NFT}/1`
    );
    assert.equal(
      getOpenSeaItemUrl(NFT, "1", 8453),
      `https://opensea.io/item/base/${NFT}/1`
    );
  });
});
