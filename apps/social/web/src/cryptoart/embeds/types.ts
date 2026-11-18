import type { ListingReference } from '../listing-links';

export const DESK_EMBED_CAP = 4;

export type DeskStubKind = 'gallery' | 'studio-collection' | 'burn-to-mint' | 'lssvm-pool';

export type DeskEmbedKind =
  | 'cryptoart-listing'
  | 'nft-token'
  | 'frame'
  | 'quote'
  | 'video'
  | 'image'
  | 'open-graph'
  | 'plain-link'
  | `stub-${DeskStubKind}`;

export type DeskQuoteEmbed = {
  hash: string;
  text?: string;
  author?: { username?: string; displayName?: string; pfpUrl?: string };
  previewUrl?: string;
};

export type DeskVideoEmbed = {
  url: string;
  sourceUrl: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
};

export type DeskTokenEmbed = {
  label: string;
  href: string;
  chainId?: number;
  contractAddress?: string;
  tokenId?: string;
  raw: string;
};

export type DeskImageEmbed = { type: 'image'; url: string; sourceUrl: string; alt: string };

export type DeskUrlEmbed = {
  type: 'url';
  openGraph: {
    url: string;
    sourceUrl: string;
    title?: string;
    description?: string;
    image?: string;
    frameEmbedNext?: {
      frameUrl: string;
      frameEmbed: {
        version: '1';
        imageUrl?: string;
        button: { title: string; action: { type: 'launch_miniapp'; name: string; url: string } };
      };
    };
  };
};

export type DeskCastEmbeds = {
  images: DeskImageEmbed[];
  urls: DeskUrlEmbed[];
  unknowns: { type: 'unknown'; source: string }[];
  videos?: DeskVideoEmbed[];
  quotes?: DeskQuoteEmbed[];
  tokens?: DeskTokenEmbed[];
};

export type ClassifiedEmbed =
  | { kind: 'cryptoart-listing'; key: string; listing: ListingReference & { originalUrl: string } }
  | { kind: 'nft-token'; key: string; token: DeskTokenEmbed }
  | { kind: 'frame'; key: string; url: string; frame: NonNullable<DeskUrlEmbed['openGraph']['frameEmbedNext']> }
  | { kind: 'quote'; key: string; quote: DeskQuoteEmbed }
  | { kind: 'video'; key: string; video: DeskVideoEmbed }
  | { kind: 'image'; key: string; image: DeskImageEmbed }
  | { kind: 'open-graph'; key: string; urlEmbed: DeskUrlEmbed }
  | { kind: 'plain-link'; key: string; href: string; label?: string }
  | { kind: `stub-${DeskStubKind}`; key: string; href: string; stub: DeskStubKind };