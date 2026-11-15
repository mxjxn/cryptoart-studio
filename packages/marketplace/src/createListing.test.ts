import { describe, expect, it } from 'vitest';
import { BASE_MARKETPLACE_ADDRESS, marketplaceAddress } from './addresses';
import {
  MAX_UINT48,
  TOKEN_SPEC_ERC1155,
  TOKEN_SPEC_ERC721,
  TOKEN_SPEC_NONE,
  approvalCheck,
  buildCreateListingArgs,
  describeTxFailure,
  listingConfirmedOnChain,
  listingIdFromCreateLogs,
  listingSchedule,
  parseEthToWei,
  studioCollectionApprovalModel,
  tokenIdFromMintLogs,
} from './createListing';
import { ListingType } from './lifecycle';

const MARKET = '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9';
const TOKEN = '0x00000000000000000000000000000000000000aa';
const SELLER = '0x00000000000000000000000000000000000000bb';
const NOW = 1_700_000_000;

const base = {
  tokenAddress: TOKEN,
  tokenId: 4n,
  now: NOW,
  acceptOffers: false,
  supportsLazyDelivery: false,
  minIncrementBPS: 500,
  extensionInterval: 0,
  metadataUri: 'ar://example',
};

describe('marketplace address for preview chains', () => {
  it('keeps Base mainnet and requires an explicit address on Base Sepolia', () => {
    expect(marketplaceAddress(8453)).toBe(BASE_MARKETPLACE_ADDRESS);
    expect(() => marketplaceAddress(84532)).toThrow(/84532/);
    expect(marketplaceAddress(84532, '0x0000000000000000000000000000000000000abc')).toBe(
      '0x0000000000000000000000000000000000000abc',
    );
    expect(() => marketplaceAddress(84532, '  ')).toThrow(/84532/);
  });
});

describe('studio collection approval', () => {
  it('does not expect setMarketplaceApproval or a factory pre-approval', () => {
    expect(studioCollectionApprovalModel()).toEqual({
      setMarketplaceApproval: false,
      factoryPreapprovesMarketplace: false,
      erc721: 'approve-or-setApprovalForAll',
      erc1155: 'setApprovalForAll',
    });
  });

  it('treats operator approval as enough for both standards', () => {
    expect(
      approvalCheck({
        standard: 'erc721',
        marketplace: MARKET,
        approvedForAll: true,
        tokenOperator: null,
      }),
    ).toEqual({ needed: false, via: 'setApprovalForAll' });
    expect(
      approvalCheck({
        standard: 'erc1155',
        marketplace: MARKET,
        approvedForAll: true,
      }),
    ).toEqual({ needed: false, via: 'setApprovalForAll' });
  });

  it('accepts a single-token ERC-721 approval and asks for approve when it is missing', () => {
    expect(
      approvalCheck({
        standard: 'erc721',
        marketplace: MARKET,
        approvedForAll: false,
        tokenOperator: MARKET.toLowerCase(),
      }),
    ).toEqual({ needed: false, via: 'approve' });
    expect(
      approvalCheck({
        standard: 'erc721',
        marketplace: MARKET,
        approvedForAll: false,
        tokenOperator: '0x0000000000000000000000000000000000000000',
      }),
    ).toEqual({ needed: true, method: 'approve' });
  });

  it('asks ERC-1155 for setApprovalForAll because the standard has no per-token approve', () => {
    expect(
      approvalCheck({
        standard: 'erc1155',
        marketplace: MARKET,
        approvedForAll: false,
        tokenOperator: MARKET,
      }),
    ).toEqual({ needed: true, method: 'setApprovalForAll' });
  });
});

describe('buildCreateListingArgs', () => {
  it('builds a non-lazy ERC-721 auction that starts on the first bid', () => {
    const result = buildCreateListingArgs({
      ...base,
      kind: 'auction',
      tokenStandard: 'erc721',
      totalAvailable: 1,
      totalPerSale: 1,
      initialAmountWei: 50_000_000_000_000_000n,
      startTime: 0,
      endTime: 7 * 24 * 3600,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.args.listingDetails).toMatchObject({
      initialAmount: 50_000_000_000_000_000n,
      type_: ListingType.INDIVIDUAL_AUCTION,
      totalAvailable: 1,
      totalPerSale: 1,
      extensionInterval: 0,
      minIncrementBPS: 500,
      startTime: 0,
      endTime: 7 * 24 * 3600,
    });
    expect(result.args.listingDetails.erc20).toBe('0x0000000000000000000000000000000000000000');
    expect(result.args.tokenDetails).toEqual({
      id: 4n,
      address_: TOKEN,
      spec: TOKEN_SPEC_ERC721,
      lazy: false,
    });
    expect(result.args.acceptOffers).toBe(false);
    expect(result.args.enableReferrer).toBe(false);
    expect(result.args.data).toBe('0x');
    expect(result.args.deliveryFees).toEqual({ deliverBPS: 0, deliverFixed: 0n });
    expect(result.args.listingReceivers).toEqual([]);
    expect(result.metadataUri).toBe('ar://example');
  });

  it('builds a fixed-price ERC-1155 listing and clears auction-only fields', () => {
    const result = buildCreateListingArgs({
      ...base,
      kind: 'fixed',
      tokenStandard: 'erc1155',
      totalAvailable: 10,
      totalPerSale: 1,
      initialAmountWei: 1n,
      startTime: NOW + 120,
      endTime: NOW + 120 + 3600,
      minIncrementBPS: 500,
      extensionInterval: 900,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.args.listingDetails.type_).toBe(ListingType.FIXED_PRICE);
    expect(result.args.listingDetails.minIncrementBPS).toBe(0);
    expect(result.args.listingDetails.extensionInterval).toBe(0);
    expect(result.args.listingDetails.totalAvailable).toBe(10);
    expect(result.args.listingDetails.totalPerSale).toBe(1);
    expect(result.args.tokenDetails.spec).toBe(TOKEN_SPEC_ERC1155);
    expect(result.args.tokenDetails.lazy).toBe(false);
  });

  it('refuses offers-only until the collection implements ILazyDelivery', () => {
    const result = buildCreateListingArgs({
      ...base,
      kind: 'offers',
      tokenStandard: 'erc721',
      totalAvailable: 1,
      totalPerSale: 1,
      initialAmountWei: 0n,
      startTime: NOW + 60,
      endTime: MAX_UINT48,
      supportsLazyDelivery: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/ILazyDelivery/);
  });

  it('builds offers-only as a lazy listing and does not set acceptOffers', () => {
    const result = buildCreateListingArgs({
      ...base,
      kind: 'offers',
      tokenStandard: 'erc721',
      totalAvailable: 1,
      totalPerSale: 1,
      initialAmountWei: 0n,
      startTime: NOW + 60,
      endTime: MAX_UINT48,
      supportsLazyDelivery: true,
      acceptOffers: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.args.listingDetails.type_).toBe(ListingType.OFFERS_ONLY);
    expect(result.args.listingDetails.initialAmount).toBe(0n);
    expect(result.args.listingDetails.minIncrementBPS).toBe(0);
    expect(result.args.listingDetails.extensionInterval).toBe(0);
    expect(result.args.acceptOffers).toBe(false);
    expect(result.args.tokenDetails.lazy).toBe(true);
    expect(result.args.tokenDetails.spec).toBe(TOKEN_SPEC_NONE);
  });

  it('rejects shapes the auction house reverts', () => {
    expect(
      buildCreateListingArgs({
        ...base,
        kind: 'auction',
        tokenStandard: 'erc721',
        totalAvailable: 2,
        totalPerSale: 1,
        initialAmountWei: 1n,
        startTime: 0,
        endTime: 3600,
      }).ok,
    ).toBe(false);
    expect(
      buildCreateListingArgs({
        ...base,
        kind: 'auction',
        tokenStandard: 'erc1155',
        totalAvailable: 4,
        totalPerSale: 2,
        initialAmountWei: 1n,
        startTime: 0,
        endTime: 3600,
      }).ok,
    ).toBe(false);
    expect(
      buildCreateListingArgs({
        ...base,
        kind: 'fixed',
        tokenStandard: 'erc721',
        totalAvailable: 1,
        totalPerSale: 1,
        initialAmountWei: 1n,
        startTime: NOW - 10,
        endTime: NOW + 10,
      }).ok,
    ).toBe(false);
    expect(
      buildCreateListingArgs({
        ...base,
        kind: 'fixed',
        tokenStandard: 'erc721',
        totalAvailable: 1,
        totalPerSale: 1,
        initialAmountWei: 1n,
        startTime: 0,
        endTime: 3600,
        acceptOffers: true,
      }).ok,
    ).toBe(false);
    expect(
      buildCreateListingArgs({
        ...base,
        kind: 'fixed',
        tokenStandard: 'erc1155',
        totalAvailable: 10,
        totalPerSale: 3,
        initialAmountWei: 1n,
        startTime: 0,
        endTime: 3600,
      }).ok,
    ).toBe(false);
    expect(
      buildCreateListingArgs({
        ...base,
        kind: 'auction',
        tokenStandard: 'erc721',
        totalAvailable: 1,
        totalPerSale: 1,
        initialAmountWei: 1n,
        startTime: 0,
        endTime: MAX_UINT48,
      }).ok,
    ).toBe(false);
  });
});

describe('eth parsing, failures, and chain confirmation', () => {
  it('parses ether strings to wei', () => {
    expect(parseEthToWei('0.05')).toBe(50_000_000_000_000_000n);
    expect(parseEthToWei('1')).toBe(10n ** 18n);
    expect(parseEthToWei('0')).toBe(0n);
    expect(parseEthToWei('')).toBeNull();
    expect(parseEthToWei('0.0000000000000000001')).toBeNull();
    expect(parseEthToWei('-1')).toBeNull();
  });

  it('separates a wallet rejection from a contract revert', () => {
    expect(describeTxFailure('User rejected the request.')).toEqual({
      phase: 'rejected',
      message: 'You rejected the request in your wallet. Nothing was submitted.',
    });
    expect(describeTxFailure("execution reverted with reason string 'Invalid type'").message).toBe(
      'Invalid type',
    );
  });

  it('confirms getListing against the minted token and ignores the indexer', () => {
    expect(
      listingConfirmedOnChain(
        {
          seller: SELLER,
          tokenAddress: TOKEN,
          tokenId: 4n,
          listingType: ListingType.FIXED_PRICE,
          finalized: false,
        },
        {
          seller: SELLER.toUpperCase(),
          tokenAddress: TOKEN,
          tokenId: 4n,
          listingType: ListingType.FIXED_PRICE,
        },
      ).ok,
    ).toBe(true);
    const mismatch = listingConfirmedOnChain(
      {
        seller: SELLER,
        tokenAddress: TOKEN,
        tokenId: 9n,
        listingType: ListingType.FIXED_PRICE,
        finalized: false,
      },
      {
        seller: SELLER,
        tokenAddress: TOKEN,
        tokenId: 4n,
        listingType: ListingType.FIXED_PRICE,
      },
    );
    expect(mismatch.ok).toBe(false);
  });
});

const MINTED_TOPIC = '0xe7cd4ce7f2a465edc730269a1305e8a48bad821e8fb7e152ec413829c01a53c4';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TRANSFER_SINGLE_TOPIC = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
const CREATE_LISTING_TOPIC = '0xa677084ea9aea69b2640d875bae622e3cf9d7c163f52d2f9d81daa1ed072c985';
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;

function word(value: bigint) {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

describe('listing schedule', () => {
  it('turns a first-sale auction into a duration and refuses an open-ended one', () => {
    expect(
      listingSchedule({
        kind: 'auction',
        now: NOW,
        startsOnFirstSale: true,
        startTime: null,
        durationSeconds: 3600,
        openEnded: false,
      }),
    ).toEqual({ ok: true, startTime: 0, endTime: 3600 });
    expect(
      listingSchedule({
        kind: 'auction',
        now: NOW,
        startsOnFirstSale: true,
        startTime: null,
        durationSeconds: null,
        openEnded: false,
      }).ok,
    ).toBe(false);
    expect(
      listingSchedule({
        kind: 'auction',
        now: NOW,
        startsOnFirstSale: false,
        startTime: null,
        durationSeconds: 3600,
        openEnded: true,
      }).ok,
    ).toBe(false);
  });

  it('schedules offers in the future and keeps them open-ended only when asked', () => {
    expect(
      listingSchedule({
        kind: 'offers',
        now: NOW,
        startsOnFirstSale: false,
        startTime: NOW + 60,
        durationSeconds: null,
        openEnded: true,
      }),
    ).toEqual({ ok: true, startTime: NOW + 60, endTime: MAX_UINT48 });
    expect(
      listingSchedule({
        kind: 'offers',
        now: NOW,
        startsOnFirstSale: true,
        startTime: null,
        durationSeconds: 3600,
        openEnded: false,
      }).ok,
    ).toBe(false);
  });
});

describe('mint and listing logs', () => {
  it('prefers the SuchCollection Minted event', () => {
    expect(
      tokenIdFromMintLogs([
        { topics: [TRANSFER_TOPIC, ZERO_TOPIC, word(1n), word(9n)], data: '0x' },
        { topics: [MINTED_TOPIC, word(1n), word(4n)], data: '0x' },
      ]),
    ).toBe('4');
  });

  it('falls back to an ERC-721 or ERC-1155 mint transfer', () => {
    expect(
      tokenIdFromMintLogs([{ topics: [TRANSFER_TOPIC, ZERO_TOPIC, word(1n), word(4n)], data: '0x' }]),
    ).toBe('4');
    expect(
      tokenIdFromMintLogs([
        {
          topics: [TRANSFER_SINGLE_TOPIC, word(1n), ZERO_TOPIC, word(2n)],
          data: `${word(8n)}${word(10n).slice(2)}`,
        },
      ]),
    ).toBe('8');
    expect(tokenIdFromMintLogs([])).toBeNull();
  });

  it('reads the listing id from the indexed CreateListing topic', () => {
    expect(
      listingIdFromCreateLogs([
        { topics: ['0x1111111111111111111111111111111111111111111111111111111111111111', word(3n)], data: '0x' },
        { topics: [CREATE_LISTING_TOPIC, word(12n)], data: '0x' },
      ]),
    ).toBe('12');
    expect(listingIdFromCreateLogs([])).toBeNull();
  });
});
