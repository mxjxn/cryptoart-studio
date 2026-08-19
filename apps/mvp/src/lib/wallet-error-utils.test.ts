import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getActionableWalletErrorMessage,
  getErrorMessage,
  isChainSwitchErrorMessage,
  isUnrecognizedChainError,
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

  it("detects missing-chain (4902) failures", () => {
    assert.equal(isChainSwitchErrorMessage("Unrecognized chain ID '0x1'. Try adding the chain using wallet_addEthereumChain first."), true);
    assert.equal(isChainSwitchErrorMessage("error 4902"), true);
  });
});

describe("isUnrecognizedChainError", () => {
  it("detects EIP-1193 code 4902 on the error or its cause", () => {
    assert.equal(isUnrecognizedChainError({ code: 4902, message: "Unrecognized chain" }), true);
    assert.equal(
      isUnrecognizedChainError({
        message: "SwitchChainError",
        cause: { code: 4902, message: "Unrecognized chain ID" },
      }),
      true
    );
  });

  it("ignores unrelated errors", () => {
    assert.equal(isUnrecognizedChainError(new Error("User rejected the request")), false);
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

  it("replaces 4902 missing-chain failures with a browser fallback hint", () => {
    assert.equal(
      getActionableWalletErrorMessage(
        { code: 4902, message: "Unrecognized chain ID" },
        "Fallback",
        "Ethereum"
      ),
      "Couldn't switch your wallet to Ethereum. Try again, or open this listing in your browser."
    );
  });
});
