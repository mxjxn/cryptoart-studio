import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addEthereumChainParameterFor } from "./chain-rpc";

describe("addEthereumChainParameterFor", () => {
  it("returns EIP-3085 params for Ethereum mainnet", () => {
    const params = addEthereumChainParameterFor(1);
    assert.ok(params);
    assert.equal(params.chainId, "0x1");
    assert.equal(params.chainName, "Ethereum");
    assert.equal(params.nativeCurrency?.symbol, "ETH");
    assert.ok(params.rpcUrls.length > 0);
    assert.ok(params.blockExplorerUrls?.includes("https://etherscan.io"));
  });

  it("returns EIP-3085 params for Base", () => {
    const params = addEthereumChainParameterFor(8453);
    assert.ok(params);
    assert.equal(params.chainId, "0x2105");
    assert.equal(params.chainName, "Base");
    assert.ok(params.rpcUrls.length > 0);
  });

  it("returns undefined for unsupported chains", () => {
    assert.equal(addEthereumChainParameterFor(137), undefined);
  });
});
