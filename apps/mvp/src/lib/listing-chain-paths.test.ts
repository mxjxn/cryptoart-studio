import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveSupportedListingChainId,
  explicitListingDetailPath,
  LISTING_CHAIN_SLUG_BASE,
  LISTING_CHAIN_SLUG_ETH,
  chainIdToListingChainSlug,
} from "./listing-chain-paths";
import {
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
} from "./server/subgraph-endpoints";

describe("explicitListingDetailPath", () => {
  it("builds an Ethereum listing path with an explicit chain segment", () => {
    assert.equal(
      explicitListingDetailPath(ETHEREUM_MAINNET_CHAIN_ID, "100"),
      "/listing/eth/100"
    );
  });

  it("builds a Base listing path with an explicit chain segment", () => {
    assert.equal(
      explicitListingDetailPath(BASE_CHAIN_ID, "100"),
      "/listing/base/100"
    );
  });
});

describe("chainIdToListingChainSlug", () => {
  it("maps supported chains to explicit slugs", () => {
    assert.equal(
      chainIdToListingChainSlug(ETHEREUM_MAINNET_CHAIN_ID),
      LISTING_CHAIN_SLUG_ETH
    );
    assert.equal(chainIdToListingChainSlug(BASE_CHAIN_ID), LISTING_CHAIN_SLUG_BASE);
  });
});

describe("deriveSupportedListingChainId", () => {
  it("prefers an explicit numeric chain id", () => {
    assert.equal(
      deriveSupportedListingChainId({ chainId: ETHEREUM_MAINNET_CHAIN_ID, network: "base" }),
      ETHEREUM_MAINNET_CHAIN_ID
    );
  });

  it("derives Ethereum from chain name aliases", () => {
    assert.equal(
      deriveSupportedListingChainId({ chainName: "Ethereum Mainnet" }),
      ETHEREUM_MAINNET_CHAIN_ID
    );
    assert.equal(
      deriveSupportedListingChainId({ network: "mainnet" }),
      ETHEREUM_MAINNET_CHAIN_ID
    );
  });

  it("derives Base from network aliases", () => {
    assert.equal(
      deriveSupportedListingChainId({ chainSlug: "base" }),
      BASE_CHAIN_ID
    );
    assert.equal(
      deriveSupportedListingChainId({ network: "base-mainnet" }),
      BASE_CHAIN_ID
    );
  });
});
