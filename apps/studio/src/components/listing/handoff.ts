/** Query passed from the mint step into the listing form. Track B fills `metadataUri` with `ar://…`. */
export type MintListingHandoff = {
  tokenId?: string | null;
  metadataUri?: string | null;
  mintTxHash?: string | null;
  /** ERC-1155 amount from the mint step. */
  quantity?: string | null;
};

export function listingHandoffPath(collectionId: string, handoff: MintListingHandoff = {}) {
  const params = new URLSearchParams();
  if (handoff.tokenId) params.set('tokenId', handoff.tokenId);
  if (handoff.metadataUri) params.set('metadataUri', handoff.metadataUri);
  if (handoff.mintTxHash) params.set('mintTx', handoff.mintTxHash);
  if (handoff.quantity) params.set('quantity', handoff.quantity);
  const query = params.toString();
  return `/collections/${collectionId}/list${query ? `?${query}` : ''}`;
}
