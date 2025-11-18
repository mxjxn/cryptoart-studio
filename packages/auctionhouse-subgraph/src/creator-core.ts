import {
  ExtensionRegistered,
  ExtensionUnregistered,
  ExtensionBlacklisted,
  RoyaltiesUpdated,
  DefaultRoyaltiesUpdated,
  ExtensionRoyaltiesUpdated,
} from "../generated/CreatorCore/CreatorCore";
import { Collection, Extension, Royalty, TokenRoyalty } from "../generated/schema";
import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";

// Helper function to get or create a collection
function getOrCreateCollection(contractAddress: Address, blockNumber: BigInt, timestamp: BigInt): Collection {
  let id = contractAddress.toHexString();
  let collection = Collection.load(id);
  
  if (collection == null) {
    collection = new Collection(id);
    collection.address = contractAddress;
    collection.totalSupply = BigInt.fromI32(0);
    collection.createdAt = timestamp;
    collection.createdAtBlock = blockNumber;
  }
  
  return collection;
}

// Handle ExtensionRegistered event
export function handleExtensionRegistered(event: ExtensionRegistered): void {
  let collection = getOrCreateCollection(
    event.address,
    event.block.number,
    event.block.timestamp
  );
  
  let extensionId = collection.id + "-" + event.params.extension.toHexString();
  let extension = Extension.load(extensionId);
  
  if (extension == null) {
    extension = new Extension(extensionId);
    extension.collection = collection.id;
    extension.address = event.params.extension;
    extension.baseURIIdentical = false;
    extension.blacklisted = false;
    extension.registeredAt = event.block.timestamp;
    extension.registeredAtBlock = event.block.number;
  }
  
  extension.save();
  collection.save();
}

// Handle ExtensionUnregistered event
export function handleExtensionUnregistered(event: ExtensionUnregistered): void {
  let collection = getOrCreateCollection(
    event.address,
    event.block.number,
    event.block.timestamp
  );
  
  let extensionId = collection.id + "-" + event.params.extension.toHexString();
  let extension = Extension.load(extensionId);
  
  if (extension != null) {
    extension.unregisteredAt = event.block.timestamp;
    extension.save();
  }
  
  collection.save();
}

// Handle ExtensionBlacklisted event
export function handleExtensionBlacklisted(event: ExtensionBlacklisted): void {
  let collection = getOrCreateCollection(
    event.address,
    event.block.number,
    event.block.timestamp
  );
  
  let extensionId = collection.id + "-" + event.params.extension.toHexString();
  let extension = Extension.load(extensionId);
  
  if (extension != null) {
    extension.blacklisted = true;
    extension.blacklistedAt = event.block.timestamp;
    extension.save();
  }
  
  collection.save();
}

// Handle RoyaltiesUpdated event (token-specific royalties)
export function handleRoyaltiesUpdated(event: RoyaltiesUpdated): void {
  let collection = getOrCreateCollection(
    event.address,
    event.block.number,
    event.block.timestamp
  );
  
  // Remove existing token royalties for this token
  // Note: In a real implementation, you'd want to track and update existing royalties
  // For now, we'll create new ones (the schema allows multiple receivers per token)
  
  let receivers = event.params.receivers;
  let basisPoints = event.params.basisPoints;
  
  for (let i = 0; i < receivers.length; i++) {
    let royaltyId = collection.id + "-" + event.params.tokenId.toString() + "-" + receivers[i].toHexString();
    let royalty = new TokenRoyalty(royaltyId);
    royalty.collection = collection.id;
    royalty.tokenId = event.params.tokenId;
    royalty.receiver = receivers[i];
    royalty.basisPoints = basisPoints[i].toI32();
    royalty.save();
  }
  
  collection.save();
}

// Handle DefaultRoyaltiesUpdated event
export function handleDefaultRoyaltiesUpdated(event: DefaultRoyaltiesUpdated): void {
  let collection = getOrCreateCollection(
    event.address,
    event.block.number,
    event.block.timestamp
  );
  
  // Remove existing default royalties
  // Note: In a real implementation, you'd want to track and update existing royalties
  // For now, we'll create new ones
  
  let receivers = event.params.receivers;
  let basisPoints = event.params.basisPoints;
  
  for (let i = 0; i < receivers.length; i++) {
    let royaltyId = collection.id + "-" + receivers[i].toHexString();
    let royalty = new Royalty(royaltyId);
    royalty.collection = collection.id;
    royalty.receiver = receivers[i];
    royalty.basisPoints = basisPoints[i].toI32();
    royalty.save();
  }
  
  collection.save();
}

// Handle ExtensionRoyaltiesUpdated event
export function handleExtensionRoyaltiesUpdated(event: ExtensionRoyaltiesUpdated): void {
  let collection = getOrCreateCollection(
    event.address,
    event.block.number,
    event.block.timestamp
  );
  
  // Extension royalties are similar to default royalties but scoped to an extension
  // For now, we'll store them similarly (you might want a separate entity type)
  let receivers = event.params.receivers;
  let basisPoints = event.params.basisPoints;
  
  for (let i = 0; i < receivers.length; i++) {
    // Use extension address in the ID to distinguish from default royalties
    let royaltyId = collection.id + "-ext-" + event.params.extension.toHexString() + "-" + receivers[i].toHexString();
    let royalty = new Royalty(royaltyId);
    royalty.collection = collection.id;
    royalty.receiver = receivers[i];
    royalty.basisPoints = basisPoints[i].toI32();
    royalty.save();
  }
  
  collection.save();
}

