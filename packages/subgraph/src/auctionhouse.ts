import {
  Address,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  ListingCreated,
  Purchase,
  BidPlaced,
  ListingFinalized,
} from "../generated/MarketplaceUpgradeable/MarketplaceUpgradeable";
import { Listing, Purchase as PurchaseEntity, Bid } from "../generated/schema";
import { MarketplaceUpgradeable } from "../generated/MarketplaceUpgradeable/MarketplaceUpgradeable";
import { MarketplaceLib } from "../generated/MarketplaceUpgradeable/MarketplaceLib";

export function handleListingCreated(event: ListingCreated): void {
  let listingId = event.params.listingId;
  let listingEntityId = listingId.toString();
  
  let listing = new Listing(listingEntityId);
  listing.listingId = listingId;
  listing.marketplace = event.address;
  listing.status = "ACTIVE";
  listing.totalSold = BigInt.zero();
  listing.createdAt = event.block.timestamp;
  listing.createdAtBlock = event.block.number;
  
  // Try to get listing details from contract
  let marketplace = MarketplaceUpgradeable.bind(event.address);
  let listingResult = marketplace.try_getListing(listingId);
  
  if (!listingResult.reverted) {
    let listingData = listingResult.value;
    listing.seller = listingData.seller;
    listing.tokenAddress = listingData.token.address_;
    listing.tokenId = listingData.token.id;
    listing.tokenSpec = listingData.token.spec == 0 ? "ERC721" : "ERC1155";
    listing.listingType = _getListingTypeString(listingData.details.type_);
    listing.initialAmount = listingData.details.initialAmount;
    listing.totalAvailable = listingData.details.totalAvailable;
    listing.totalPerSale = listingData.details.totalPerSale;
    listing.startTime = listingData.details.startTime;
    listing.endTime = listingData.details.endTime;
    listing.lazy = listingData.token.lazy;
  } else {
    // Fallback values
    listing.seller = Address.zero();
    listing.tokenAddress = Address.zero();
    listing.tokenId = BigInt.zero();
    listing.tokenSpec = "ERC721";
    listing.listingType = "FIXED_PRICE";
    listing.initialAmount = BigInt.zero();
    listing.totalAvailable = BigInt.zero();
    listing.totalPerSale = BigInt.zero();
    listing.startTime = BigInt.zero();
    listing.endTime = BigInt.zero();
    listing.lazy = false;
  }
  
  listing.save();
  
  log.info("Listing created: {} by seller {}", [
    listingId.toString(),
    listing.seller.toHexString(),
  ]);
}

export function handlePurchase(event: Purchase): void {
  let listingId = event.params.listingId;
  let listingEntityId = listingId.toString();
  let listing = Listing.load(listingEntityId);
  
  if (listing == null) {
    log.warning("Purchase event for unknown listing: {}", [listingId.toString()]);
    return;
  }
  
  // Create purchase entity
  let purchaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let purchase = new PurchaseEntity(purchaseId);
  purchase.listing = listingEntityId;
  purchase.buyer = event.params.buyer;
  purchase.amount = event.params.amount;
  purchase.quantity = event.params.quantity;
  purchase.timestamp = event.block.timestamp;
  purchase.blockNumber = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  
  // Try to get token ID from listing
  purchase.tokenId = listing.tokenId;
  
  purchase.save();
  
  // Update listing
  listing.totalSold = listing.totalSold.plus(event.params.quantity);
  
  // Check if listing is fully sold
  if (listing.totalSold.ge(listing.totalAvailable)) {
    listing.status = "FINALIZED";
    listing.finalizedAt = event.block.timestamp;
  }
  
  listing.save();
  
  log.info("Purchase: {} bought {} of listing {}", [
    event.params.buyer.toHexString(),
    event.params.quantity.toString(),
    listingId.toString(),
  ]);
}

export function handleBidPlaced(event: BidPlaced): void {
  let listingId = event.params.listingId;
  let listingEntityId = listingId.toString();
  let listing = Listing.load(listingEntityId);
  
  if (listing == null) {
    log.warning("Bid event for unknown listing: {}", [listingId.toString()]);
    return;
  }
  
  // Create bid entity
  let bidId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let bid = new Bid(bidId);
  bid.listing = listingEntityId;
  bid.bidder = event.params.bidder;
  bid.amount = event.params.amount;
  bid.timestamp = event.block.timestamp;
  bid.blockNumber = event.block.number;
  bid.transactionHash = event.transaction.hash;
  
  // Check if this is the winning bid
  let marketplace = MarketplaceUpgradeable.bind(event.address);
  let listingResult = marketplace.try_getListing(listingId);
  
  if (!listingResult.reverted) {
    let listingData = listingResult.value;
    bid.isWinning = listingData.buyer == event.params.bidder;
  } else {
    bid.isWinning = false;
  }
  
  bid.save();
  
  // Update listing current price
  listing.currentPrice = event.params.amount;
  listing.save();
  
  log.info("Bid placed: {} bid {} on listing {}", [
    event.params.bidder.toHexString(),
    event.params.amount.toString(),
    listingId.toString(),
  ]);
}

export function handleListingFinalized(event: ListingFinalized): void {
  let listingId = event.params.listingId;
  let listingEntityId = listingId.toString();
  let listing = Listing.load(listingEntityId);
  
  if (listing == null) {
    log.warning("Finalization event for unknown listing: {}", [listingId.toString()]);
    return;
  }
  
  listing.status = "FINALIZED";
  listing.finalizedAt = event.block.timestamp;
  listing.save();
  
  log.info("Listing finalized: {}", [listingId.toString()]);
}

function _getListingTypeString(listingType: i32): string {
  if (listingType == 0) {
    return "INDIVIDUAL_AUCTION";
  } else if (listingType == 1) {
    return "FIXED_PRICE";
  } else if (listingType == 2) {
    return "DYNAMIC_PRICE";
  } else {
    return "UNKNOWN";
  }
}

