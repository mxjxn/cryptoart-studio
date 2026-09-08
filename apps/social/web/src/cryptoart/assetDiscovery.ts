import type {
  OwnedAsset,
  OwnedAssetPage,
  SupportedChainId,
  TokenStandard,
} from './domain';
import {
  createPublicClient,
  http,
  isAddressEqual,
  parseAbi,
  type Address,
} from 'viem';
import { base, mainnet } from 'viem/chains';

type Fetch = typeof fetch;
type AlchemyNft = {
  contract?: { address?: string };
  tokenId?: string;
  tokenType?: string;
  balance?: string;
  name?: string | null;
  description?: string | null;
  image?: {
    cachedUrl?: string | null;
    thumbnailUrl?: string | null;
    pngUrl?: string | null;
    originalUrl?: string | null;
  };
  raw?: {
    metadata?: {
      name?: string;
      description?: string;
      image?: string;
      image_url?: string;
    } | null;
  };
};

const API_ROOT: Record<SupportedChainId, string> = {
  1: 'https://eth-mainnet.g.alchemy.com/nft/v3',
  8453: 'https://base-mainnet.g.alchemy.com/nft/v3',
};

const erc721Abi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
]);
const erc1155Abi = parseAbi([
  'function balanceOf(address owner, uint256 tokenId) view returns (uint256)',
]);

export async function verifyAssetOwnership(
  asset: OwnedAsset,
  owner: string,
): Promise<boolean> {
  const chain = asset.id.chainId === 1 ? mainnet : base;
  const client = createPublicClient({ chain, transport: http() });
  if (asset.standard === 'ERC1155') {
    const balance = await client.readContract({
      address: asset.id.contractAddress as Address,
      abi: erc1155Abi,
      functionName: 'balanceOf',
      args: [owner as Address, BigInt(asset.id.tokenId)],
    });
    return balance > 0n;
  }
  const currentOwner = await client.readContract({
    address: asset.id.contractAddress as Address,
    abi: erc721Abi,
    functionName: 'ownerOf',
    args: [BigInt(asset.id.tokenId)],
  });
  return isAddressEqual(currentOwner, owner as Address);
}

export function normalizeAlchemyAsset(
  nft: AlchemyNft,
  owner: string,
  chainId: SupportedChainId,
): OwnedAsset | null {
  const contractAddress = nft.contract?.address;
  const tokenId = nft.tokenId;
  if (!contractAddress || !tokenId) return null;
  const metadata = nft.raw?.metadata;
  const previewUrl =
    nft.image?.cachedUrl ??
    nft.image?.thumbnailUrl ??
    nft.image?.pngUrl ??
    nft.image?.originalUrl ??
    metadata?.image ??
    metadata?.image_url;
  const standard: TokenStandard =
    nft.tokenType?.toUpperCase() === 'ERC1155' ? 'ERC1155' : 'ERC721';
  return {
    id: { chainId, contractAddress: contractAddress.toLowerCase(), tokenId },
    title: nft.name ?? metadata?.name ?? `Token #${tokenId}`,
    description: nft.description ?? metadata?.description,
    media: { canonicalUrl: metadata?.image ?? metadata?.image_url, previewUrl },
    standard,
    balance: nft.balance ?? '1',
    owner: owner.toLowerCase(),
    source: 'alchemy',
    metadataStatus:
      previewUrl || nft.name || metadata?.name ? 'resolved' : 'missing',
  };
}

export function createAssetDiscoveryService(
  apiKey: string | undefined,
  request: Fetch = fetch,
  verify: (
    asset: OwnedAsset,
    owner: string,
  ) => Promise<boolean> = verifyAssetOwnership,
) {
  async function owned(
    url: URL,
  ): Promise<{ status: number; body: OwnedAssetPage | { error: string } }> {
    const owner = url.searchParams.get('owner') ?? '';
    const chainId = Number(url.searchParams.get('chainId')) as SupportedChainId;
    if (!/^0x[a-fA-F0-9]{40}$/.test(owner))
      return { status: 400, body: { error: 'Invalid wallet address.' } };
    if (chainId !== 1 && chainId !== 8453)
      return { status: 400, body: { error: 'Unsupported chain.' } };
    if (!apiKey)
      return {
        status: 503,
        body: {
          error:
            'Configure ALCHEMY_API_KEY on the Social server to discover wallet items.',
        },
      };

    const endpoint = new URL(`${API_ROOT[chainId]}/getNFTsForOwner`);
    endpoint.searchParams.set('owner', owner);
    endpoint.searchParams.set('withMetadata', 'true');
    endpoint.searchParams.set('pageSize', '24');
    const pageKey = url.searchParams.get('pageKey');
    if (pageKey) endpoint.searchParams.set('pageKey', pageKey);
    const response = await request(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(`Asset provider returned ${response.status}`);
    const data = (await response.json()) as {
      ownedNfts?: AlchemyNft[];
      pageKey?: string | null;
    };
    const items = (data.ownedNfts ?? [])
      .map((nft) => normalizeAlchemyAsset(nft, owner, chainId))
      .filter((item): item is OwnedAsset => item !== null);
    return {
      status: 200,
      body: {
        items,
        nextPageKey: data.pageKey ?? null,
        degraded: false,
        warnings: [],
      },
    };
  }

  async function imported(
    url: URL,
  ): Promise<{ status: number; body: OwnedAsset | { error: string } }> {
    const owner = url.searchParams.get('owner') ?? '';
    const contract = url.searchParams.get('contract') ?? '';
    const tokenId = url.searchParams.get('tokenId') ?? '';
    const chainId = Number(url.searchParams.get('chainId')) as SupportedChainId;
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(owner) ||
      !/^0x[a-fA-F0-9]{40}$/.test(contract) ||
      !/^\d+$/.test(tokenId)
    ) {
      return {
        status: 400,
        body: { error: 'Enter a valid owner, contract, and numeric token ID.' },
      };
    }
    if (chainId !== 1 && chainId !== 8453)
      return { status: 400, body: { error: 'Unsupported chain.' } };
    if (!apiKey)
      return {
        status: 503,
        body: {
          error:
            'Configure ALCHEMY_API_KEY on the Social server to import items.',
        },
      };
    const endpoint = new URL(`${API_ROOT[chainId]}/getNFTMetadata`);
    endpoint.searchParams.set('contractAddress', contract);
    endpoint.searchParams.set('tokenId', tokenId);
    endpoint.searchParams.set('refreshCache', 'false');
    const response = await request(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(`Asset provider returned ${response.status}`);
    const normalized = normalizeAlchemyAsset(
      (await response.json()) as AlchemyNft,
      owner,
      chainId,
    );
    if (!normalized)
      return {
        status: 404,
        body: { error: 'The token could not be resolved.' },
      };
    if (!(await verify(normalized, owner)))
      return {
        status: 403,
        body: { error: 'This wallet does not currently own that token.' },
      };
    return {
      status: 200,
      body: { ...normalized, source: 'manual', verifiedAt: Date.now() },
    };
  }

  return { owned, imported };
}
