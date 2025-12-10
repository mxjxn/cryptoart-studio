import {
  CreateListing,
  CreateListingTokenDetails,
  CreateListingFees,
  PurchaseEvent,
  BidEvent,
  OfferEvent,
  RescindOfferEvent,
  AcceptOfferEvent,
  ModifyListing,
  CancelListing,
  FinalizeListing,
} from "../generated/MarketplaceCore/MarketplaceLib";
import {
  Escrow as EscrowEvent,
} from "../generated/SettlementLib/SettlementLib";
import {
  MarketplaceEnabled,
  MarketplaceFees,
  MarketplaceSellerRegistry,
} from "../generated/MarketplaceCore/MarketplaceCore";
import { Listing, Purchase, Bid, Offer, Escrow } from "../generated/schema";
import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";

// Helper function to get or create a listing
// IMPORTANT: Initialize ALL non-nullable fields with defaults to avoid save errors
function getOrCreateListing(listingId: BigInt, blockNumber: BigInt, timestamp: BigInt): Listing {
  let id = listingId.toString();
  let listing = Listing.load(id);
  
  if (listing == null) {
    listing = new Listing(id);
    listing.listingId = listingId;
    listing.marketplace = Address.fromString("0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9");
    
    // Initialize all non-nullable fields with defaults
    // These will be overwritten by the actual event handlers
    listing.seller = Address.zero();
    listing.tokenAddress = Address.zero();
    listing.tokenSpec = 0;
    listing.lazy = false;
    listing.listingType = 0;
    listing.initialAmount = BigInt.fromI32(0);
    listing.totalAvailable = 0;
    listing.totalPerSale = 0;
    listing.totalSold = 0;
    listing.startTime = BigInt.fromI32(0);
    listing.endTime = BigInt.fromI32(0);
    listing.extensionInterval = 0;
    listing.minIncrementBPS = 0;
    listing.marketplaceBPS = 0;
    listing.referrerBPS = 0;
    listing.deliverBPS = 0;
    listing.deliverFixed = BigInt.fromI32(0);
    listing.status = "ACTIVE";
    listing.hasBid = false;
    listing.finalized = false;
    listing.createdAt = timestamp;
    listing.createdAtBlock = blockNumber;
    listing.updatedAt = timestamp;
    listing.updatedAtBlock = blockNumber;
  }
  
  return listing;
}

// Handle CreateListing event from MarketplaceLib
export function handleCreateListing(event: CreateListing): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  listing.seller = event.transaction.from;
  listing.listingType = event.params.listingType;
  listing.initialAmount = event.params.initialAmount;
  listing.totalAvailable = event.params.totalAvailable;
  listing.totalPerSale = event.params.totalPerSale;
  listing.startTime = event.params.startTime;
  listing.endTime = event.params.endTime;
  listing.extensionInterval = event.params.extensionInterval;
  listing.minIncrementBPS = event.params.minIncrementBPS;
  listing.erc20 = event.params.erc20;
  listing.identityVerifier = event.params.identityVerifier;
  listing.marketplaceBPS = event.params.marketplaceBPS;
  listing.referrerBPS = event.params.referrerBPS;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  
  listing.save();
}

// Handle CreateListingTokenDetails event from MarketplaceLib
export function handleCreateListingTokenDetails(event: CreateListingTokenDetails): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  listing.tokenId = event.params.id;
  listing.tokenAddress = event.params.address_;
  listing.tokenSpec = event.params.spec;
  listing.lazy = event.params.lazy;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  
  listing.save();
}

// Handle CreateListingFees event from MarketplaceLib
export function handleCreateListingFees(event: CreateListingFees): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  listing.deliverBPS = event.params.deliverBPS;
  listing.deliverFixed = event.params.deliverFixed;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  
  listing.save();
}

// Handle PurchaseEvent from MarketplaceLib
export function handlePurchaseEvent(event: PurchaseEvent): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  // Update listing total sold
  // Note: event.params.count is the purchase count, but the contract actually sells count * totalPerSale copies
  // The contract does: listing.totalSold += count * listing.details.totalPerSale;
  listing.totalSold = listing.totalSold + event.params.count * listing.totalPerSale;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();
  
  // Create Purchase entity
  let purchaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let purchase = new Purchase(purchaseId);
  purchase.listing = listing.id;
  purchase.listingId = event.params.listingId;
  purchase.referrer = event.params.referrer;
  purchase.buyer = event.params.buyer;
  purchase.count = event.params.count;
  purchase.amount = event.params.amount;
  purchase.timestamp = event.block.timestamp;
  purchase.blockNumber = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  purchase.save();
}

// Handle BidEvent from MarketplaceLib
export function handleBidEvent(event: BidEvent): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  // Update listing hasBid flag and track current high bid
  listing.hasBid = true;
  listing.currentBidder = event.params.bidder;
  listing.currentBidAmount = event.params.amount;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();
  
  // Create Bid entity
  let bidId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let bid = new Bid(bidId);
  bid.listing = listing.id;
  bid.listingId = event.params.listingId;
  bid.referrer = event.params.referrer;
  bid.bidder = event.params.bidder;
  bid.amount = event.params.amount;
  bid.timestamp = event.block.timestamp;
  bid.blockNumber = event.block.number;
  bid.transactionHash = event.transaction.hash;
  bid.save();
}

// Handle OfferEvent from MarketplaceLib
export function handleOfferEvent(event: OfferEvent): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  // Track latest offerer/amount (ABI uses "offerrer")
  listing.currentOfferer = event.params.offerrer;
  listing.currentOfferAmount = event.params.amount;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();

  // Create Offer entity
  let offerId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let offer = new Offer(offerId);
  offer.listing = listing.id;
  offer.listingId = event.params.listingId;
  offer.referrer = event.params.referrer;
  offer.offerer = event.params.offerrer; // Note: ABI has typo "offerrer" instead of "offerer"
  offer.amount = event.params.amount;
  offer.status = "PENDING";
  offer.timestamp = event.block.timestamp;
  offer.blockNumber = event.block.number;
  offer.transactionHash = event.transaction.hash;
  offer.save();
}

// Handle RescindOfferEvent from MarketplaceLib
export function handleRescindOfferEvent(event: RescindOfferEvent): void {
  // Find the offer by listingId and offerer
  // Note: This is simplified - in production you'd want to track offers by offerer address
  // For now, we'll update the most recent offer from this offerer
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  // Clear tracked offer if the rescinded offer matches
  if (listing.currentOfferer && listing.currentOfferer!.equals(event.params.offerrer)) {
    listing.currentOfferer = null;
    listing.currentOfferAmount = null;
  }

  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();
}

// Handle AcceptOfferEvent from MarketplaceLib
export function handleAcceptOfferEvent(event: AcceptOfferEvent): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  // Create a Purchase for the accepted offer
  let purchaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let purchase = new Purchase(purchaseId);
  purchase.listing = listing.id;
  purchase.listingId = event.params.listingId;
  purchase.referrer = null;
  purchase.buyer = event.params.offerrer; // ABI typo "offerrer"
  purchase.count = listing.totalPerSale;
  purchase.amount = event.params.amount;
  purchase.timestamp = event.block.timestamp;
  purchase.blockNumber = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  purchase.save();

  // Update listing state
  listing.currentOfferer = event.params.offerrer;
  listing.currentOfferAmount = event.params.amount;
  listing.status = "FINALIZED";
  listing.finalized = true;
  listing.totalSold = listing.totalSold + listing.totalPerSale;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();
}

// Handle ModifyListing from MarketplaceLib
export function handleModifyListing(event: ModifyListing): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  listing.initialAmount = event.params.initialAmount;
  listing.startTime = event.params.startTime;
  listing.endTime = event.params.endTime;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();
}

// Handle CancelListing from MarketplaceLib
export function handleCancelListing(event: CancelListing): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  listing.status = "CANCELLED";
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();
}

// Handle FinalizeListing from MarketplaceLib
export function handleFinalizeListing(event: FinalizeListing): void {
  let listing = getOrCreateListing(
    event.params.listingId,
    event.block.number,
    event.block.timestamp
  );
  
  // If there was a winning bid, create a Purchase for the auction winner
  if (listing.hasBid && listing.currentBidder) {
    let purchaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let purchase = new Purchase(purchaseId);
    purchase.listing = listing.id;
    purchase.listingId = event.params.listingId;
    purchase.referrer = null;
    purchase.buyer = listing.currentBidder as Bytes;
    purchase.count = listing.totalPerSale;
    purchase.amount = listing.currentBidAmount ? (listing.currentBidAmount as BigInt) : BigInt.fromI32(0);
    purchase.timestamp = event.block.timestamp;
    purchase.blockNumber = event.block.number;
    purchase.transactionHash = event.transaction.hash;
    purchase.save();

    // Increment totalSold for auction close
    listing.totalSold = listing.totalSold + listing.totalPerSale;
  }

  listing.status = "FINALIZED";
  listing.finalized = true;
  listing.updatedAt = event.block.timestamp;
  listing.updatedAtBlock = event.block.number;
  listing.save();
}

// Handle Escrow event from SettlementLib
export function handleEscrow(event: EscrowEvent): void {
  let escrowId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let escrow = new Escrow(escrowId);
  escrow.receiver = event.params.receiver;
  escrow.erc20 = event.params.erc20;
  escrow.amount = event.params.amount;
  escrow.timestamp = event.block.timestamp;
  escrow.blockNumber = event.block.number;
  escrow.transactionHash = event.transaction.hash;
  escrow.save();
}

