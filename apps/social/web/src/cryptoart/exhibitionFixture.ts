import type { Exhibition } from './domain';

/** Matches the planned such.gallery read contract until its versioned API is connected. */
export const editorialExhibition: Exhibition = {
  id: 'cryptoart-editorial-001',
  slug: 'works-in-public',
  title: 'Works in Public',
  description: 'Two works moving through the Cryptoart marketplace: one still open, one newly collected.',
  curator: '@mxjxn',
  source: 'such-gallery',
  publication: 'editorial',
  placements: [
    {
      id: 'respiration', position: 0, caption: 'On view and currently at auction.',
      artwork: {
        id: { chainId: 1, contractAddress: '0xa80664f124b37b9f1ecbc6bccc5cdc9f8afb15bb', tokenId: '1' },
        title: 'Respiration', description: 'Day 8 of Render till December.', artist: '@mxjxn',
        media: {
          canonicalUrl: 'https://arweave.net/vMZIEzO-qHSTpF6sfgtQP_LTB3b1wy1mhoYq-IfI4C0',
          previewUrl: 'https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/2e4643bd5e404271.webp',
        },
      },
      commerce: { kind: 'auction', chainId: 1, id: '5', href: '/listing/eth/5', amount: '0.05', currency: 'ETH', available: 1, bidCount: 0, status: 'active' },
    },
    {
      id: 'nearcaster', position: 1, caption: 'Recently acquired for 0.02 ETH.',
      artwork: {
        id: { chainId: 1, contractAddress: '0xcefc0f50336d3ebf055cdf4308d0661e2e4674b0', tokenId: '1' },
        title: 'NEARCASTER', description: 'D.1775 · 3600×4200 · 300dpi · RGB', artist: '@push-',
        media: {
          canonicalUrl: 'https://arweave.net/ODHW40EnIL8Aib8AtRWz31zrdwZdoyQRIzGyDdoDOzE',
          previewUrl: 'https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/710855c3883a0a9a.webp',
        },
      },
    },
  ],
};
