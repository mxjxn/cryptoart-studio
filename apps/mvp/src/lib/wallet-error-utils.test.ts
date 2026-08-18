import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getActionableWalletErrorMessage,
  getErrorMessage,
  isChainSwitchErrorMessage,
} from "./wallet-error-utils";

describe("getErrorMessage", () => {
  it("prefers Error.message when present", () => {
    assert.equal(getErrorMessage(new Error("Bid failed"), "Fallback"), "Bid failed");
  });

  it("falls back when the error is empty", () => {
    assert.equal(getErrorMessage(null, "Fallback"), "Fallback");
  });
});

describe("isChainSwitchErrorMessage", () => {
  it("detects wallet switch failures", () => {
    assert.equal(isChainSwitchErrorMessage("SwitchChainError: wallet_switchEthereumChain failed"), true);
    assert.equal(isChainSwitchErrorMessage("Connector getChainId failed"), true);
  });

  it("ignores unrelated transaction failures", () => {
    assert.equal(isChainSwitchErrorMessage("execution reverted"), false);
  });
});

describe("getActionableWalletErrorMessage", () => {
  it("keeps non-switch errors intact", () => {
    assert.equal(
      getActionableWalletErrorMessage(new Error("execution reverted"), "Fallback", "Ethereum"),
      "execution reverted"
    );
  });

  it("replaces switch failures with a browser fallback hint", () => {
    assert.equal(
      getActionableWalletErrorMessage(
        new Error("SwitchChainError: wallet_switchEthereumChain failed"),
        "Fallback",
        "Ethereum"
      ),
      "Couldn't switch your wallet to Ethereum. Try again, or open this listing in your browser."
    );
  });
});
