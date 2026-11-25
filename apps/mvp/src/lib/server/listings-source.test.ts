import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { getListingsSource, isIndexerListingsSource } from "./listings-source";

describe("listings-source", () => {
  afterEach(() => {
    delete process.env.LISTINGS_SOURCE;
  });

  it("defaults to indexer", () => {
    assert.equal(getListingsSource(), "indexer");
    assert.equal(isIndexerListingsSource(), true);
  });

  it("honors LISTINGS_SOURCE=subgraph", () => {
    process.env.LISTINGS_SOURCE = "subgraph";
    assert.equal(getListingsSource(), "subgraph");
    assert.equal(isIndexerListingsSource(), false);
  });
});