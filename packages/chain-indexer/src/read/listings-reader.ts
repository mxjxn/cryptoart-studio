import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@cryptoart/db/client';
import { bids, listings, type Bid } from '../schema';
import { MARKETPLACE_CONTRACTS } from '../config/contracts';
import { mapListingRow, type SubgraphLikeListing } from './listing-map';

function chainIdsToQuery(chainIdFilter?: number): number[] {
  if (chainIdFilter != null) return [chainIdFilter];
  const ids = new Set(MARKETPLACE_CONTRACTS.map((c) => c.chainId));
  return [...ids];
}

async function loadBidsForListings(
  keys: Array<{ chainId: number; listingId: string }>
): Promise<Map<string, Bid[]>> {
  const byKey = new Map<string, Bid[]>();
  if (keys.length === 0) return byKey;

  const chainIds = [...new Set(keys.map((k) => k.chainId))];
  const listingIds = [...new Set(keys.map((k) => k.listingId))];

  const rows = await db
    .select()
    .from(bids)
    .where(
      and(inArray(bids.chainId, chainIds), inArray(bids.listingId, listingIds))
    );

  for (const row of rows) {
    const key = `${row.chainId}:${String(row.listingId)}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  return byKey;
}

export async function fetchIndexerListingsByListingId(
  listingId: string,
  chainIdFilter?: number
): Promise<SubgraphLikeListing[]> {
  const chains = chainIdsToQuery(chainIdFilter);
  const listingIdNum = parseInt(listingId, 10);
  const isNumeric = !Number.isNaN(listingIdNum);

  const conditions = [inArray(listings.chainId, chains)];
  if (isNumeric) {
    conditions.push(eq(listings.listingId, String(listingIdNum)));
  } else {
    conditions.push(eq(listings.listingId, listingId));
  }

  const rows = await db.select().from(listings).where(and(...conditions));
  const bidMap = await loadBidsForListings(
    rows.map((r) => ({ chainId: r.chainId, listingId: String(r.listingId) }))
  );

  return rows.map((row) => {
    const key = `${row.chainId}:${String(row.listingId)}`;
    return mapListingRow(row, bidMap.get(key) ?? [], row.chainId);
  });
}

/**
 * Active, non-finalized listings across configured marketplaces (mirrors subgraph active query).
 */
export async function fetchActiveListingsFromIndexer(
  first: number,
  skip: number,
  chainIdFilter?: number
): Promise<SubgraphLikeListing[]> {
  const chains = chainIdsToQuery(chainIdFilter);
  const limit = Math.min(Math.max(first, 0), 1000);

  const rows = await db
    .select()
    .from(listings)
    .where(
      and(
        inArray(listings.chainId, chains),
        eq(listings.status, 'ACTIVE'),
        eq(listings.finalized, 0)
      )
    )
    .orderBy(desc(listings.createdAt))
    .limit(limit)
    .offset(Math.max(skip, 0));

  const bidMap = await loadBidsForListings(
    rows.map((r) => ({ chainId: r.chainId, listingId: String(r.listingId) }))
  );

  return rows.map((row) => {
    const key = `${row.chainId}:${String(row.listingId)}`;
    return mapListingRow(row, bidMap.get(key) ?? [], row.chainId);
  });
}