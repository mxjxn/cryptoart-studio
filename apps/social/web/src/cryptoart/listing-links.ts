export interface ListingReference { chainId: 1 | 8453; listingId: string; url: string }

/** Recognize only Cryptoart routes. A parsed reference is not verified auction state. */
export function parseListingUrl(raw: string): ListingReference | null {
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || !['cryptoart.social', 'www.cryptoart.social'].includes(url.hostname) || url.username || url.password) return null;
    const match = /^\/listing\/(?:(eth|base)\/)?(\d+)\/?$/.exec(url.pathname);
    if (!match) return null;
    const query = url.searchParams.get('chainId');
    const explicitChain = match[1] === 'eth' ? 1 : match[1] === 'base' ? 8453 : undefined;
    if (query !== null && query !== '1' && query !== '8453') return null;
    const queryChain = query === null ? undefined : Number(query);
    if (explicitChain && queryChain && explicitChain !== queryChain) return null;
    const chainId = (explicitChain ?? queryChain ?? 8453) as 1 | 8453;
    const listingId = BigInt(match[2]).toString();
    return { chainId, listingId, url: `https://cryptoart.social/listing/${chainId === 1 ? 'eth/' : ''}${listingId}` };
  } catch { return null; }
}

export function listingReferences(text: string, embeds: string[] = []): ListingReference[] {
  const urls = [...embeds, ...(text.match(/https?:\/\/[^\s<>]+/g) ?? []).map(url => url.replace(/[),.!?;]+$/, ''))];
  const references = new Map<string, ListingReference>();
  for (const url of urls) {
    const ref = parseListingUrl(url);
    if (ref) references.set(`${ref.chainId}:${ref.listingId}`, ref);
  }
  return [...references.values()];
}
