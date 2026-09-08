export type SupportedChainId = 1 | 8453;
export type TokenStandard = 'ERC721' | 'ERC1155';

export interface ArtworkId {
  chainId: SupportedChainId;
  contractAddress: string;
  tokenId: string;
}

export type AssetSource = 'cryptoart' | 'alchemy' | 'manual';
export type AssetMetadataStatus = 'resolved' | 'missing' | 'unreachable';

export interface OwnedAsset extends Artwork {
  standard: TokenStandard;
  balance: string;
  owner: string;
  source: AssetSource;
  metadataStatus: AssetMetadataStatus;
  verifiedAt?: number;
}

export interface OwnedAssetPage {
  items: OwnedAsset[];
  nextPageKey: string | null;
  degraded: boolean;
  warnings: string[];
}

export interface Artwork {
  id: ArtworkId;
  title: string;
  description?: string;
  artist?: string;
  media: {
    canonicalUrl?: string;
    previewUrl?: string;
  };
}

export type CommerceKind =
  | 'auction'
  | 'fixed-price'
  | 'dynamic-price'
  | 'offers'
  | 'lazy-mint'
  | 'liquidity-pool';

export interface CommerceSummary {
  kind: CommerceKind;
  chainId: SupportedChainId;
  id: string;
  href: string;
  amount: string;
  currency: string;
  available: number;
  bidCount: number;
  status: 'active' | 'finished' | 'cancelled';
}

export interface MarketItem {
  artwork: Artwork;
  commerce: CommerceSummary;
  createdAt: number;
}

export interface ExhibitionPlacement {
  id: string;
  position: number;
  artwork: Artwork;
  caption?: string;
  commerce?: CommerceSummary;
}

export interface Exhibition {
  id: string;
  slug: string;
  title: string;
  description: string;
  curator: string;
  source: 'such-gallery';
  publication: 'editorial' | 'trending';
  placements: ExhibitionPlacement[];
}

export interface MarketPageResult {
  items: MarketItem[];
  pagination: { first: number; skip: number; hasMore: boolean };
  degraded: boolean;
}
