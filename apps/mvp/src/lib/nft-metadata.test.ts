import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandTokenUriIdPlaceholder } from "./nft-metadata";

describe("expandTokenUriIdPlaceholder", () => {
  it("returns the original URI when there is no {id} placeholder", () => {
    assert.deepEqual(
      expandTokenUriIdPlaceholder("ipfs://bafybeiabc/metadata.json", 1n),
      ["ipfs://bafybeiabc/metadata.json"]
    );
  });

  it("substitutes decimal then 64-char hex for ERC-1155 templates", () => {
    const uri = "ipfs://bafybeiczl4e4n235nrupg2gzblx7e6jc4eybnqgg3tu6sjcnbp5x5mi6dm/{id}";
    assert.deepEqual(expandTokenUriIdPlaceholder(uri, 1n), [
      "ipfs://bafybeiczl4e4n235nrupg2gzblx7e6jc4eybnqgg3tu6sjcnbp5x5mi6dm/1",
      "ipfs://bafybeiczl4e4n235nrupg2gzblx7e6jc4eybnqgg3tu6sjcnbp5x5mi6dm/0000000000000000000000000000000000000000000000000000000000000001",
    ]);
  });

  it("handles URL-encoded {id} and token ids above 9", () => {
    const uri = "https://example.com/meta/%7Bid%7D.json";
    assert.deepEqual(expandTokenUriIdPlaceholder(uri, 10n), [
      "https://example.com/meta/10.json",
      "https://example.com/meta/000000000000000000000000000000000000000000000000000000000000000a.json",
    ]);
  });
});
