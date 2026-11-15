import { ListingType, ZERO_ADDRESS } from './lifecycle';

/**
 * SuchCollection and SuchCollection1155 do not implement `setMarketplaceApproval`.
 * SuchCollectionFactory only deploys the collection and records the artist.
 * The auction house pulls the token with transferFrom / safeTransferFrom, so
 * approval is the token owner's standard ERC-721 / ERC-1155 approval. A factory
 * cannot grant that.
 */
export function studioCollectionApprovalModel() {
  return {
    setMarketplaceApproval: false,
    factoryPreapprovesMarketplace: false,
    erc721: 'approve-or-setApprovalForAll' as const,
    erc1155: 'setApprovalForAll' as const,
  };
}

export type TokenStandard = 'erc721' | 'erc1155';

export function approvalCheck(input: {
  standard: TokenStandard;
  marketplace: string;
  approvedForAll: boolean;
  tokenOperator?: string | null;
}):
  | { needed: false; via: 'setApprovalForAll' | 'approve' }
  | { needed: true; method: 'setApprovalForAll' | 'approve' } {
  if (input.approvedForAll) return { needed: false, via: 'setApprovalForAll' };
  if (
    input.standard === 'erc721' &&
    input.tokenOperator &&
    input.tokenOperator.toLowerCase() === input.marketplace.toLowerCase()
  ) {
    return { needed: false, via: 'approve' };
  }
  if (input.standard === 'erc1155') return { needed: true, method: 'setApprovalForAll' };
  return { needed: true, method: 'approve' };
}

export const TOKEN_SPEC_NONE = 0;
export const TOKEN_SPEC_ERC721 = 1;
export const TOKEN_SPEC_ERC1155 = 2;
export const MAX_UINT48 = 281_474_976_710_655;
const MAX_UINT24 = 16_777_215;
const MAX_UINT16 = 65_535;

export const MINTED_TOPIC = '0xe7cd4ce7f2a465edc730269a1305e8a48bad821e8fb7e152ec413829c01a53c4';
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const TRANSFER_SINGLE_TOPIC = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
export const CREATE_LISTING_TOPIC = '0xa677084ea9aea69b2640d875bae622e3cf9d7c163f52d2f9d81daa1ed072c985';
/** type(ILazyDelivery).interfaceId — deliver(uint40,address,uint256,uint24,uint256,address,uint256) XOR ERC-165. */
export const LAZY_DELIVERY_INTERFACE_ID = '0x8e4adea9';

const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type ListingKind = 'auction' | 'fixed' | 'offers';

export type ListingLog = { topics: readonly string[]; data: string };

export type CreateListingDraft = {
  kind: ListingKind;
  tokenStandard: TokenStandard;
  tokenAddress: string;
  tokenId: bigint;
  totalAvailable: number;
  totalPerSale: number;
  initialAmountWei: bigint;
  now: number;
  startTime: number;
  endTime: number;
  minIncrementBPS: number;
  extensionInterval: number;
  acceptOffers: boolean;
  supportsLazyDelivery: boolean;
  /** Passed through for the mint handoff. Track B supplies `ar://…`. Not an on-chain argument. */
  metadataUri?: string | null;
};

export type CreateListingCall = {
  listingDetails: {
    initialAmount: bigint;
    type_: ListingType;
    totalAvailable: number;
    totalPerSale: number;
    extensionInterval: number;
    minIncrementBPS: number;
    erc20: typeof ZERO_ADDRESS;
    identityVerifier: typeof ZERO_ADDRESS;
    startTime: number;
    endTime: number;
  };
  tokenDetails: {
    id: bigint;
    address_: `0x${string}`;
    spec: number;
    lazy: boolean;
  };
  deliveryFees: { deliverBPS: 0; deliverFixed: 0n };
  listingReceivers: [];
  enableReferrer: false;
  acceptOffers: boolean;
  data: '0x';
};

export function listingSchedule(input: {
  kind: ListingKind;
  now: number;
  startsOnFirstSale: boolean;
  startTime: number | null;
  durationSeconds: number | null;
  openEnded: boolean;
}): { ok: true; startTime: number; endTime: number } | { ok: false; error: string } {
  if (input.kind === 'offers') {
    if (input.startsOnFirstSale) {
      return { ok: false, error: 'Offers-only listings have to start in the future. They cannot start on the first offer.' };
    }
    if (input.startTime === null || input.startTime <= input.now) {
      return { ok: false, error: 'Choose a start time in the future for this offers-only listing.' };
    }
    if (input.openEnded) return { ok: true, startTime: input.startTime, endTime: MAX_UINT48 };
    if (!input.durationSeconds || input.durationSeconds <= 0) {
      return { ok: false, error: 'Enter a duration, or leave the listing open-ended.' };
    }
    return { ok: true, startTime: input.startTime, endTime: input.startTime + input.durationSeconds };
  }

  if (input.openEnded) {
    return {
      ok: false,
      error: 'Auctions and fixed-price listings need a duration. An open end overflows when the sale starts on the first bid or purchase.',
    };
  }
  if (!input.durationSeconds || input.durationSeconds <= 0) {
    return { ok: false, error: 'Enter how long the listing should run.' };
  }
  if (input.durationSeconds >= MAX_UINT48) {
    return { ok: false, error: 'That duration does not fit in the auction house clock.' };
  }
  if (input.startsOnFirstSale) return { ok: true, startTime: 0, endTime: input.durationSeconds };
  if (input.startTime === null || input.startTime <= input.now) {
    return { ok: false, error: 'Choose a start time in the future, or start on the first bid or purchase.' };
  }
  return { ok: true, startTime: input.startTime, endTime: input.startTime + input.durationSeconds };
}

export function buildCreateListingArgs(
  draft: CreateListingDraft,
): { ok: true; args: CreateListingCall; metadataUri: string | null } | { ok: false; error: string } {
  if (!ADDRESS.test(draft.tokenAddress)) return { ok: false, error: 'Token contract address is not valid.' };
  if (draft.tokenId < 0n) return { ok: false, error: 'Token id is not valid.' };
  if (!fitsUint24(draft.totalAvailable) || !fitsUint24(draft.totalPerSale)) {
    return { ok: false, error: 'Quantity does not fit the auction house limits.' };
  }
  if (draft.totalPerSale < 1 || draft.totalAvailable < 1) {
    return { ok: false, error: 'Quantity has to be at least 1.' };
  }
  if (draft.totalAvailable % draft.totalPerSale !== 0) {
    return { ok: false, error: 'Total quantity has to divide evenly by the amount per sale.' };
  }
  if (draft.tokenStandard === 'erc721' && (draft.totalAvailable !== 1 || draft.totalPerSale !== 1)) {
    return { ok: false, error: 'An ERC-721 listing sells exactly one token.' };
  }
  if (draft.kind === 'auction' && draft.totalAvailable !== draft.totalPerSale) {
    return { ok: false, error: 'An auction has to sell its whole lot in one bid. Total quantity and amount per sale must match.' };
  }
  if (draft.endTime <= draft.startTime) return { ok: false, error: 'End time has to be after the start.' };
  if (draft.endTime > MAX_UINT48) return { ok: false, error: 'End time does not fit the auction house clock.' };
  if (draft.startTime !== 0 && draft.startTime <= draft.now) {
    return { ok: false, error: 'Start time is in the past. Use the first bid or purchase, or pick a future start.' };
  }
  if (draft.startTime === 0 && draft.endTime >= MAX_UINT48) {
    return {
      ok: false,
      error: 'An open-ended duration overflows when the listing starts on the first bid or purchase.',
    };
  }
  if (draft.initialAmountWei < 0n) return { ok: false, error: 'Price cannot be negative.' };

  const lazy = draft.kind === 'offers';
  if (lazy) {
    if (!draft.supportsLazyDelivery) {
      return {
        ok: false,
        error:
          'Offers-only listings require ILazyDelivery. This collection can be listed as an auction or a fixed price. Lazy mint is not part of this flow.',
      };
    }
    if (draft.initialAmountWei !== 0n) return { ok: false, error: 'Offers-only listings cannot set a price. The offer sets the amount.' };
    if (draft.startTime <= draft.now) return { ok: false, error: 'Offers-only listings have to start in the future.' };
    if (draft.totalPerSale !== 1) return { ok: false, error: 'A lazy listing delivers one token per sale.' };
  } else if (draft.acceptOffers && draft.kind !== 'auction') {
    return { ok: false, error: 'Only an auction can also accept offers. The auction house reverts otherwise.' };
  }

  const auctionFields = draft.kind === 'auction';
  if (auctionFields && (!fitsUint16(draft.minIncrementBPS) || !fitsUint16(draft.extensionInterval))) {
    return { ok: false, error: 'Bid increment and extension have to fit in 16 bits.' };
  }

  const args: CreateListingCall = {
    listingDetails: {
      initialAmount: draft.initialAmountWei,
      type_: kindToType(draft.kind),
      totalAvailable: draft.totalAvailable,
      totalPerSale: draft.totalPerSale,
      extensionInterval: auctionFields ? draft.extensionInterval : 0,
      minIncrementBPS: auctionFields ? draft.minIncrementBPS : 0,
      erc20: ZERO_ADDRESS,
      identityVerifier: ZERO_ADDRESS,
      startTime: draft.startTime,
      endTime: draft.endTime,
    },
    tokenDetails: {
      id: draft.tokenId,
      address_: draft.tokenAddress as `0x${string}`,
      spec: lazy ? TOKEN_SPEC_NONE : draft.tokenStandard === 'erc1155' ? TOKEN_SPEC_ERC1155 : TOKEN_SPEC_ERC721,
      lazy,
    },
    deliveryFees: { deliverBPS: 0, deliverFixed: 0n },
    listingReceivers: [],
    enableReferrer: false,
    acceptOffers: draft.kind === 'auction' ? draft.acceptOffers : false,
    data: '0x',
  };

  return { ok: true, args, metadataUri: draft.metadataUri?.trim() ? draft.metadataUri.trim() : null };
}

export function parseEthToWei(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > 18) return null;
  try {
    return BigInt(whole ?? '0') * 10n ** 18n + BigInt(fraction.padEnd(18, '0') || '0');
  } catch {
    return null;
  }
}

export function describeTxFailure(message: string): { phase: 'rejected' | 'failed'; message: string } {
  const lower = message.toLowerCase();
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return { phase: 'rejected', message: 'You rejected the request in your wallet. Nothing was submitted.' };
  }
  const quoted = message.match(/reason string '([^']+)'/i)?.[1];
  const reason = message.match(/reason:\s*([^\n(]+)/i)?.[1];
  const reverted = message.match(/reverted:?\s*([^\n(]+)/i)?.[1];
  const picked = (quoted || reason || reverted || '').trim().replace(/\.$/, '');
  if (picked) return { phase: 'failed', message: picked };
  const cleaned = message.trim();
  if (cleaned && cleaned.length < 280) return { phase: 'failed', message: cleaned };
  return { phase: 'failed', message: 'The transaction failed. You can retry.' };
}

export function listingConfirmedOnChain(
  listing: {
    seller: string;
    tokenAddress: string;
    tokenId: bigint;
    listingType: number;
    finalized: boolean;
  },
  expected: { seller: string; tokenAddress: string; tokenId: bigint; listingType: number },
): { ok: true } | { ok: false; message: string } {
  if (listing.seller.toLowerCase() !== expected.seller.toLowerCase()) {
    return { ok: false, message: 'Seller does not match the connected wallet.' };
  }
  if (listing.tokenAddress.toLowerCase() !== expected.tokenAddress.toLowerCase()) {
    return { ok: false, message: 'Listing token contract does not match this collection.' };
  }
  if (listing.tokenId !== expected.tokenId) {
    return { ok: false, message: 'Listing token id does not match the minted token.' };
  }
  if (listing.listingType !== expected.listingType) {
    return { ok: false, message: 'Listing type does not match the transaction you submitted.' };
  }
  if (listing.finalized) return { ok: false, message: 'Listing is already finalized.' };
  return { ok: true };
}

export function tokenIdFromMintLogs(logs: readonly ListingLog[]): string | null {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i];
    if (log?.topics[0]?.toLowerCase() !== MINTED_TOPIC) continue;
    const id = topicValue(log.topics[2]);
    if (id !== null) return id.toString();
  }
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i];
    if (!log) continue;
    const topic0 = log.topics[0]?.toLowerCase();
    if (topic0 === TRANSFER_TOPIC && log.topics[1]?.toLowerCase() === ZERO_TOPIC) {
      const id = topicValue(log.topics[3]);
      if (id !== null) return id.toString();
    }
    if (topic0 === TRANSFER_SINGLE_TOPIC && log.topics[2]?.toLowerCase() === ZERO_TOPIC) {
      const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
      if (data.length >= 64) return BigInt(`0x${data.slice(0, 64)}`).toString();
    }
  }
  return null;
}

export function listingIdFromCreateLogs(logs: readonly ListingLog[]): string | null {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i];
    if (log?.topics[0]?.toLowerCase() !== CREATE_LISTING_TOPIC) continue;
    const id = topicValue(log.topics[1]);
    if (id !== null) return id.toString();
  }
  return null;
}

function kindToType(kind: ListingKind): ListingType {
  if (kind === 'auction') return ListingType.INDIVIDUAL_AUCTION;
  if (kind === 'fixed') return ListingType.FIXED_PRICE;
  return ListingType.OFFERS_ONLY;
}

function fitsUint24(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_UINT24;
}

function fitsUint16(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_UINT16;
}

function topicValue(topic: string | undefined): bigint | null {
  if (!topic || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  return BigInt(topic);
}
