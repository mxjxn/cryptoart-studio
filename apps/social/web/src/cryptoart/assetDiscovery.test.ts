import { describe, expect, it, vi } from 'vitest';
import {
  createAssetDiscoveryService,
  normalizeAlchemyAsset,
} from './assetDiscovery';

const owner = '0x1111111111111111111111111111111111111111';
const contract = '0x2222222222222222222222222222222222222222';
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

describe('asset discovery', () => {
  it('retains a valid token when its metadata is missing', () => {
    expect(
      normalizeAlchemyAsset(
        {
          contract: { address: contract },
          tokenId: '7',
          tokenType: 'ERC1155',
          balance: '3',
        },
        owner,
        8453,
      ),
    ).toMatchObject({
      id: { chainId: 8453, contractAddress: contract, tokenId: '7' },
      title: 'Token #7',
      standard: 'ERC1155',
      balance: '3',
      metadataStatus: 'missing',
    });
  });

  it('proxies wallet discovery without exposing the provider key to the client response', async () => {
    const request = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toContain('/nft/v3/getNFTsForOwner');
      expect(String(url)).not.toContain('secret');
      expect(init?.headers).toEqual({ Authorization: 'Bearer secret' });
      return json({
        ownedNfts: [
          { contract: { address: contract }, tokenId: '1', name: 'Work' },
        ],
        pageKey: 'next',
      });
    }) as unknown as typeof fetch;
    const result = await createAssetDiscoveryService('secret', request).owned(
      new URL(`${'http://local'}?owner=${owner}&chainId=1`),
    );
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain('secret');
    expect(result.body).toMatchObject({
      items: [{ title: 'Work' }],
      nextPageKey: 'next',
    });
  });

  it('only admits a manual import after onchain ownership verification', async () => {
    const request = vi.fn(async () =>
      json({
        contract: { address: contract },
        tokenId: '9',
        tokenType: 'ERC721',
        name: 'Found work',
      }),
    ) as unknown as typeof fetch;
    const rejected = await createAssetDiscoveryService(
      'key',
      request,
      async () => false,
    ).imported(
      new URL(
        `http://local?owner=${owner}&chainId=8453&contract=${contract}&tokenId=9`,
      ),
    );
    expect(rejected.status).toBe(403);
    const accepted = await createAssetDiscoveryService(
      'key',
      request,
      async () => true,
    ).imported(
      new URL(
        `http://local?owner=${owner}&chainId=8453&contract=${contract}&tokenId=9`,
      ),
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({
      source: 'manual',
      verifiedAt: expect.any(Number),
    });
  });
});
