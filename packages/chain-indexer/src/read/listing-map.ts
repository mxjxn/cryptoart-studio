import type { Bid, Listing } from '../schema';

/** Subgraph-shaped listing row (pre-normalization). */
export type SubgraphLikeListing = {
  id: string;
  listingId: string;
  chainId: number;
  marketplace: string;
  seller: string;
  tokenAddress: string;
  tokenId?: string;
  tokenSpec: number;
  listingType: number;
  initialAmount: string;
  totalAvailable: string;
  totalPerSale: string;
  startTime: string;
  endTime: string;
  lazy: boolean;
  status: string;
  totalSold: string;
  hasBid: boolean;
  finalized: boolean;
  createdAt: string;
  createdAtBlock: string;
  updatedAt: string;
  erc20?: string;
  bids: Array<{
    id: string;
    bidder: string;
    amount: string;
    timestamp: string;
  }>;
};

function timestampToUnixSeconds(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Math.floor(d.getTime() / 1000).toString();
}

function bigintishToString(value: bigint | number | string | null | undefined): string {
  if (value == null) return '0';
  return typeof value === 'bigint' ? value.toString() : String(value);
}

export function mapBidRow(row: Bid): SubgraphLikeListing['bids'][number] {
  return {
    id: `${row.transactionHash}-${row.logIndex}`,
    bidder: row.bidder,
    amount: String(row.amount),
    timestamp: bigintishToString(row.timestamp),
  };
}

export function mapListingRow(
  row: Listing,
  bidRows: Bid[],
  chainId: number
): SubgraphLikeListing {
  const listingId = String(row.listingId);
  const sortedBids = [...bidRows].sort((a, b) => {
    const amtA = BigInt(String(a.amount));
    const amtB = BigInt(String(b.amount));
    if (amtA !== amtB) return amtA > amtB ? -1 : 1;
    return Number(a.timestamp) - Number(b.timestamp);
  });

  return {
    id: listingId,
    listingId,
    chainId,
    marketplace: row.marketplace,
    seller: row.seller,
    tokenAddress: row.tokenAddress,
    tokenId: row.tokenId != null ? String(row.tokenId) : undefined,
    tokenSpec: row.tokenSpec,
    listingType: row.listingType,
    initialAmount: String(row.initialAmount),
    totalAvailable: String(row.totalAvailable),
    totalPerSale: String(row.totalPerSale),
    startTime: bigintishToString(row.startTime),
    endTime: bigintishToString(row.endTime),
    lazy: row.lazy === 1,
    status: row.status,
    totalSold: String(row.totalSold),
    hasBid: row.hasBid === 1,
    finalized: row.finalized === 1,
    createdAt: timestampToUnixSeconds(row.createdAt),
    createdAtBlock: bigintishToString(row.createdAtBlock),
    updatedAt: timestampToUnixSeconds(row.updatedAt),
    erc20: row.erc20 ?? undefined,
    bids: sortedBids.map(mapBidRow),
  };
}