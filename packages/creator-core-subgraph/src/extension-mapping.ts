import { crypto, Bytes, BigInt } from "@graphprotocol/graph-ts";
import {
  ExtensionRegistered,
  ExtensionUnregistered,
  ExtensionBlacklisted,
  MintPermissionsUpdated,
  RoyaltiesUpdated,
  DefaultRoyaltiesUpdated,
  ApproveTransferUpdated,
  ExtensionRoyaltiesUpdated,
  ExtensionApproveTransferUpdated,
} from "../generated/CreatorCoreExtensions/ICreatorCore";
import {
  CreatorContract,
  Extension,
  RoyaltyOverride,
} from "../generated/schema";

function extensionId(contract: Bytes, ext: Bytes): Bytes {
  const combined = new Uint8Array(contract.length + ext.length);
  combined.set(contract, 0);
  combined.set(ext, contract.length);
  return Bytes.fromByteArray(crypto.keccak256(Bytes.fromUint8Array(combined)));
}

function addressArrayToBytes(arr: Array<Bytes>): Array<Bytes> {
  return arr;
}

function ensureCreatorContract(address: Bytes, timestamp: BigInt): void {
  let contract = CreatorContract.load(address);
  if (contract == null) {
    contract = new CreatorContract(address);
    contract.creator = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    contract.tokenStandard = "ERC721";
    contract.totalSupply = BigInt.fromI32(0);
    contract.createdAt = timestamp;
    contract.save();
  }
}

export function handleExtensionRegistered(event: ExtensionRegistered): void {
  const contractAddr = event.address;
  ensureCreatorContract(contractAddr, event.block.timestamp);

  const id = extensionId(contractAddr, event.params.extension);
  let ext = Extension.load(id);
  if (ext == null) {
    ext = new Extension(id);
    ext.contract = contractAddr;
    ext.extensionAddress = event.params.extension;
    ext.sender = event.params.sender;
    ext.status = "active";
    ext.registeredAt = event.block.timestamp;
    ext.updatedAt = event.block.timestamp;
    ext.save();
  } else {
    ext.status = "active";
    ext.updatedAt = event.block.timestamp;
    ext.save();
  }
}

export function handleExtensionUnregistered(event: ExtensionUnregistered): void {
  const id = extensionId(event.address, event.params.extension);
  const ext = Extension.load(id);
  if (ext != null) {
    ext.status = "unregistered";
    ext.updatedAt = event.block.timestamp;
    ext.save();
  }
}

export function handleExtensionBlacklisted(event: ExtensionBlacklisted): void {
  const id = extensionId(event.address, event.params.extension);
  const ext = Extension.load(id);
  if (ext != null) {
    ext.status = "blacklisted";
    ext.updatedAt = event.block.timestamp;
    ext.save();
  }
}

export function handleMintPermissionsUpdated(event: MintPermissionsUpdated): void {
  const id = extensionId(event.address, event.params.extension);
  const ext = Extension.load(id);
  if (ext != null) {
    ext.mintPermissions = event.params.permissions;
    ext.updatedAt = event.block.timestamp;
    ext.save();
  }
}

export function handleExtensionApproveTransferUpdated(event: ExtensionApproveTransferUpdated): void {
  const id = extensionId(event.address, event.params.extension);
  const ext = Extension.load(id);
  if (ext != null) {
    ext.approveTransfer = event.params.enabled;
    ext.updatedAt = event.block.timestamp;
    ext.save();
  }
}

export function handleDefaultRoyaltiesUpdated(event: DefaultRoyaltiesUpdated): void {
  const contractAddr = event.address;
  ensureCreatorContract(contractAddr, event.block.timestamp);

  const idString = contractAddr.toHexString() + "-default";
  const royaltyId = Bytes.fromByteArray(crypto.keccak256(Bytes.fromHexString(idString)));
  let royalty = RoyaltyOverride.load(royaltyId);
  if (royalty == null) {
    royalty = new RoyaltyOverride(royaltyId);
    royalty.contract = contractAddr;
    royalty.scope = "default";
  }
  royalty.receivers = changetype<Array<Bytes>>(event.params.receivers);
  royalty.basisPoints = event.params.basisPoints;
  royalty.updatedAt = event.block.timestamp;
  royalty.save();
}

export function handleRoyaltiesUpdated(event: RoyaltiesUpdated): void {
  const contractAddr = event.address;
  ensureCreatorContract(contractAddr, event.block.timestamp);

  const idString = contractAddr.toHexString() + "-token-" + event.params.tokenId.toString();
  const royaltyId = Bytes.fromByteArray(crypto.keccak256(Bytes.fromHexString(idString)));
  let royalty = RoyaltyOverride.load(royaltyId);
  if (royalty == null) {
    royalty = new RoyaltyOverride(royaltyId);
    royalty.contract = contractAddr;
    royalty.scope = "token";
    royalty.tokenId = event.params.tokenId;
  }
  royalty.receivers = changetype<Array<Bytes>>(event.params.receivers);
  royalty.basisPoints = event.params.basisPoints;
  royalty.updatedAt = event.block.timestamp;
  royalty.save();
}

export function handleExtensionRoyaltiesUpdated(event: ExtensionRoyaltiesUpdated): void {
  const contractAddr = event.address;
  ensureCreatorContract(contractAddr, event.block.timestamp);

  const idString = contractAddr.toHexString() + "-extension-" + event.params.extension.toHexString();
  const royaltyId = Bytes.fromByteArray(crypto.keccak256(Bytes.fromHexString(idString)));
  let royalty = RoyaltyOverride.load(royaltyId);
  if (royalty == null) {
    royalty = new RoyaltyOverride(royaltyId);
    royalty.contract = contractAddr;
    royalty.scope = "extension";
    royalty.extension = event.params.extension;
  }
  royalty.receivers = changetype<Array<Bytes>>(event.params.receivers);
  royalty.basisPoints = event.params.basisPoints;
  royalty.updatedAt = event.block.timestamp;
  royalty.save();
}

export function handleApproveTransferUpdated(event: ApproveTransferUpdated): void {
  ensureCreatorContract(event.address, event.block.timestamp);
}
