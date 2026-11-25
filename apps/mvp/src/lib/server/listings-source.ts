export type ListingsSource = 'indexer' | 'subgraph';

/**
 * Where auction/listing rows are loaded from. Default: indexer (chain_indexer_* tables).
 * Set LISTINGS_SOURCE=subgraph to roll back to The Graph while the indexer backfills.
 */
export function getListingsSource(): ListingsSource {
  const raw = (process.env.LISTINGS_SOURCE ?? 'indexer').trim().toLowerCase();
  return raw === 'subgraph' ? 'subgraph' : 'indexer';
}

export function isIndexerListingsSource(): boolean {
  return getListingsSource() === 'indexer';
}