import {
  Address,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  ExtensionRegistered,
  ExtensionUnregistered,
  ExtensionBlacklisted,
  RoyaltiesUpdated,
  DefaultRoyaltiesUpdated,
  Transfer as TransferEvent,
  TransferSingle,
  TransferBatch,
} from "../generated/ERC721Creator/ERC721Creator";
import {
  CreatorCore,
  Extension,
  Token,
  MintEvent,
  TransferEvent as TransferEventEntity,
  RoyaltyUpdate,
} from "../generated/schema";
import { ERC721Creator } from "../generated/ERC721Creator/ERC721Creator";
import { ERC1155Creator } from "../generated/ERC1155Creator/ERC1155Creator";

// Helper to get or create CreatorCore entity
function getOrCreateCreatorCore(
  address: Address,
  event: ethereum.Event
): CreatorCore {
  let creatorCore = CreatorCore.load(address.toHexString());
  
  if (creatorCore == null) {
    creatorCore = new CreatorCore(address.toHexString());
    creatorCore.createdAt = event.block.timestamp;
    creatorCore.createdAtBlock = event.block.number;
    creatorCore.isUpgradeable = false;
    
    // Try to get name and symbol
    let contract = ERC721Creator.bind(address);
    let nameResult = contract.try_name();
    if (nameResult.reverted) {
      let contract1155 = ERC1155Creator.bind(address);
      nameResult = contract1155.try_name();
    }
    if (!nameResult.reverted) {
      creatorCore.name = nameResult.value;
    }
    
    let symbolResult = contract.try_symbol();
    if (symbolResult.reverted) {
      let contract1155 = ERC1155Creator.bind(address);
      symbolResult = contract1155.try_symbol();
    }
    if (!symbolResult.reverted) {
      creatorCore.symbol = symbolResult.value;
    }
    
    // Determine type by checking if it's ERC721 or ERC1155
    let ownerResult = contract.try_owner();
    if (ownerResult.reverted) {
      let contract1155 = ERC1155Creator.bind(address);
      ownerResult = contract1155.try_owner();
      creatorCore.type = "ERC1155";
    } else {
      creatorCore.type = "ERC721";
    }
    
    if (!ownerResult.reverted) {
      creatorCore.owner = ownerResult.value;
    } else {
      creatorCore.owner = Address.zero();
    }
    
    creatorCore.save();
  }
  
  return creatorCore;
}

// Helper to get or create Extension entity
function getOrCreateExtension(
  extensionAddress: Address,
  creatorCore: CreatorCore,
  baseURI: string,
  event: ethereum.Event
): Extension {
  let extensionId = extensionAddress.toHexString();
  let extension = Extension.load(extensionId);
  
  if (extension == null) {
    extension = new Extension(extensionId);
    extension.creatorCore = creatorCore.id;
    extension.baseURI = baseURI;
    extension.baseURIIdentical = false;
    extension.registeredAt = event.block.timestamp;
    extension.registeredAtBlock = event.block.number;
    extension.isBlacklisted = false;
    extension.save();
  }
  
  return extension;
}

// Helper to get or create Token entity
function getOrCreateToken(
  creatorCore: CreatorCore,
  tokenId: BigInt,
  extension: Extension | null,
  event: ethereum.Event
): Token {
  let tokenIdString = tokenId.toString();
  let tokenEntityId = creatorCore.id + "-" + tokenIdString;
  let token = Token.load(tokenEntityId);
  
  if (token == null) {
    token = new Token(tokenEntityId);
    token.tokenId = tokenId;
    token.creatorCore = creatorCore.id;
    token.mintedAt = event.block.timestamp;
    token.mintedAtBlock = event.block.number;
    token.mintedBy = event.transaction.from;
    
    if (extension != null) {
      token.extension = extension.id;
    }
    
    // Try to get token URI
    let contract = ERC721Creator.bind(Address.fromString(creatorCore.id));
    if (creatorCore.type == "ERC721") {
      let uriResult = contract.try_tokenURI(tokenId);
      if (!uriResult.reverted) {
        token.tokenURI = uriResult.value;
      }
    }
    
    token.save();
  }
  
  return token;
}

export function handleExtensionRegistered(event: ExtensionRegistered): void {
  let creatorCore = getOrCreateCreatorCore(event.address, event);
  let extension = getOrCreateExtension(
    event.params.extension,
    creatorCore,
    "",
    event
  );
  
  log.info("Extension registered: {} on {}", [
    event.params.extension.toHexString(),
    creatorCore.id,
  ]);
}

export function handleExtensionUnregistered(event: ExtensionUnregistered): void {
  let extensionId = event.params.extension.toHexString();
  let extension = Extension.load(extensionId);
  
  if (extension != null) {
    extension.unregisteredAt = event.block.timestamp;
    extension.save();
  }
}

export function handleExtensionBlacklisted(event: ExtensionBlacklisted): void {
  let extensionId = event.params.extension.toHexString();
  let extension = Extension.load(extensionId);
  
  if (extension != null) {
    extension.isBlacklisted = true;
    extension.save();
  }
}

export function handleRoyaltiesUpdated(event: RoyaltiesUpdated): void {
  let creatorCore = getOrCreateCreatorCore(event.address, event);
  
  let royaltyUpdate = new RoyaltyUpdate(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  royaltyUpdate.creatorCore = creatorCore.id;
  royaltyUpdate.token = creatorCore.id + "-" + event.params.tokenId.toString();
  royaltyUpdate.receivers = event.params.receivers;
  royaltyUpdate.basisPoints = event.params.basisPoints;
  royaltyUpdate.isDefault = false;
  royaltyUpdate.timestamp = event.block.timestamp;
  royaltyUpdate.blockNumber = event.block.number;
  royaltyUpdate.transactionHash = event.transaction.hash;
  royaltyUpdate.save();
  
  // Update token entity if it exists
  let token = Token.load(royaltyUpdate.token);
  if (token != null) {
    // Token royalties updated
  }
}

export function handleDefaultRoyaltiesUpdated(
  event: DefaultRoyaltiesUpdated
): void {
  let creatorCore = getOrCreateCreatorCore(event.address, event);
  
  let royaltyUpdate = new RoyaltyUpdate(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  royaltyUpdate.creatorCore = creatorCore.id;
  royaltyUpdate.receivers = event.params.receivers;
  royaltyUpdate.basisPoints = event.params.basisPoints;
  royaltyUpdate.isDefault = true;
  royaltyUpdate.timestamp = event.block.timestamp;
  royaltyUpdate.blockNumber = event.block.number;
  royaltyUpdate.transactionHash = event.transaction.hash;
  royaltyUpdate.save();
}

export function handleTransfer(event: TransferEvent): void {
  let creatorCore = getOrCreateCreatorCore(event.address, event);
  
  // If from is zero address, this is a mint
  if (event.params.from.equals(Address.zero())) {
    let token = getOrCreateToken(creatorCore, event.params.tokenId, null, event);
    token.currentOwner = event.params.to;
    token.save();
    
    // Create mint event
    let mintEvent = new MintEvent(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    );
    mintEvent.creatorCore = creatorCore.id;
    mintEvent.token = token.id;
    mintEvent.to = event.params.to;
    mintEvent.tokenId = event.params.tokenId;
    mintEvent.amount = BigInt.fromI32(1);
    mintEvent.timestamp = event.block.timestamp;
    mintEvent.blockNumber = event.block.number;
    mintEvent.transactionHash = event.transaction.hash;
    mintEvent.logIndex = event.logIndex;
    mintEvent.save();
  } else {
    // This is a transfer
    let token = getOrCreateToken(creatorCore, event.params.tokenId, null, event);
    token.currentOwner = event.params.to;
    token.save();
    
    // Create transfer event
    let transferEvent = new TransferEventEntity(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    );
    transferEvent.creatorCore = creatorCore.id;
    transferEvent.token = token.id;
    transferEvent.from = event.params.from;
    transferEvent.to = event.params.to;
    transferEvent.tokenId = event.params.tokenId;
    transferEvent.amount = BigInt.fromI32(1);
    transferEvent.timestamp = event.block.timestamp;
    transferEvent.blockNumber = event.block.number;
    transferEvent.transactionHash = event.transaction.hash;
    transferEvent.logIndex = event.logIndex;
    transferEvent.save();
  }
  
  // If to is zero address, this is a burn
  if (event.params.to.equals(Address.zero())) {
    let token = Token.load(creatorCore.id + "-" + event.params.tokenId.toString());
    if (token != null) {
      token.burnTimestamp = event.block.timestamp;
      token.currentOwner = null;
      token.save();
    }
  }
}

export function handleTransferSingle(event: TransferSingle): void {
  let creatorCore = getOrCreateCreatorCore(event.address, event);
  
  // If from is zero address, this is a mint
  if (event.params.from.equals(Address.zero())) {
    let token = getOrCreateToken(creatorCore, event.params.id, null, event);
    token.totalSupply = token.totalSupply.plus(event.params.value);
    token.currentOwner = event.params.to;
    token.save();
    
    // Create mint event
    let mintEvent = new MintEvent(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    );
    mintEvent.creatorCore = creatorCore.id;
    mintEvent.token = token.id;
    mintEvent.to = event.params.to;
    mintEvent.tokenId = event.params.id;
    mintEvent.amount = event.params.value;
    mintEvent.timestamp = event.block.timestamp;
    mintEvent.blockNumber = event.block.number;
    mintEvent.transactionHash = event.transaction.hash;
    mintEvent.logIndex = event.logIndex;
    mintEvent.save();
  } else {
    // This is a transfer
    let token = getOrCreateToken(creatorCore, event.params.id, null, event);
    token.currentOwner = event.params.to;
    token.save();
    
    // Create transfer event
    let transferEvent = new TransferEventEntity(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    );
    transferEvent.creatorCore = creatorCore.id;
    transferEvent.token = token.id;
    transferEvent.from = event.params.from;
    transferEvent.to = event.params.to;
    transferEvent.tokenId = event.params.id;
    transferEvent.amount = event.params.value;
    transferEvent.timestamp = event.block.timestamp;
    transferEvent.blockNumber = event.block.number;
    transferEvent.transactionHash = event.transaction.hash;
    transferEvent.logIndex = event.logIndex;
    transferEvent.save();
  }
  
  // If to is zero address, this is a burn
  if (event.params.to.equals(Address.zero())) {
    let token = Token.load(creatorCore.id + "-" + event.params.id.toString());
    if (token != null) {
      token.totalSupply = token.totalSupply.minus(event.params.value);
      if (token.totalSupply.equals(BigInt.zero())) {
        token.burnTimestamp = event.block.timestamp;
        token.currentOwner = null;
      }
      token.save();
    }
  }
}

export function handleTransferBatch(event: TransferBatch): void {
  // Handle batch transfers for ERC1155
  let creatorCore = getOrCreateCreatorCore(event.address, event);
  
  for (let i = 0; i < event.params.ids.length; i++) {
    let tokenId = event.params.ids[i];
    let amount = event.params.values[i];
    
    // Similar logic to handleTransferSingle but for each token in batch
    if (event.params.from.equals(Address.zero())) {
      let token = getOrCreateToken(creatorCore, tokenId, null, event);
      token.totalSupply = token.totalSupply.plus(amount);
      token.currentOwner = event.params.to;
      token.save();
    } else {
      let token = getOrCreateToken(creatorCore, tokenId, null, event);
      token.currentOwner = event.params.to;
      token.save();
    }
  }
}

