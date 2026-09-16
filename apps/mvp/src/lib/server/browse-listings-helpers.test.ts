import { listingsForEnrichment } from "./browse-listings-helpers";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("listingsForEnrichment", () => {
  it("returns only the page size even when subgraph over-fetch is large", () => {
    const active = Array.from({ length: 80 }, (_, i) => ({ id: i }));
    assert.deepEqual(
      listingsForEnrichment(active, 20).map((row) => row.id),
      Array.from({ length: 20 }, (_, i) => i)
    );
  });

  it("returns an empty list when first is 0", () => {
    assert.deepEqual(listingsForEnrichment([{ id: 1 }], 0), []);
  });
});
