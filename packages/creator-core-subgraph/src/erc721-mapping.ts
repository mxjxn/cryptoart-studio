import { crypto, Bytes, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/ERC721Creator/ERC721";
import {
  CreatorContract,
  Token,
  TransferEvent,
} from "../generated/schema";

function tokenId(collection: Bytes, tId: BigInt): Bytes {
  const combined = new Uint8Array(collection.length + 32);
  combined.set(collection, 0);
  const bigIntBytes = Bytes.fromBigInt(tId);
  combined.set(bigIntBytes, collection.length);
  return Bytes.fromByteArray(crypto.keccak256(Bytes.fromUint8Array(combined)));
}

function ensureCreatorContract(
  address: Bytes,
  timestamp: BigInt,
): void {
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

export function handleTransfer(event: Transfer): void {
  const contractAddr = event.address;
  ensureCreatorContract(contractAddr, event.block.timestamp);

  const tId = BigInt.fromI32(0); // ERC721 Transfer doesn't include tokenId in event
  const tTokenId = tokenId(contractAddr, tId);
  let token = Token.load(tTokenId);

  if (token == null) {
    token = new Token(tTokenId);
    token.collection = contractAddr;
    token.tokenId = tId;
    token.owner = event.params.to;
    token.mintedBy = event.params.from;
    token.mintedAt = event.block.timestamp;
    token.burnt = false;
    token.save();
  } else {
    token.owner = event.params.to;
    if (event.params.to.equals(Bytes.fromHexString("0x0000000000000000000000000000000000000000"))) {
      token.burnt = true;
    }
    token.save();
  }

  // Build transfer ID from tx hash + log index
  const logIndexBytes = Bytes.fromBigInt(BigInt.fromI32(event.logIndex.toI32()));
  const combined = new Uint8Array(event.transaction.hash.length + logIndexBytes.length);
  combined.set(event.transaction.hash, 0);
  combined.set(logIndexBytes, event.transaction.hash.length);
  const transferId = Bytes.fromByteArray(crypto.keccak256(Bytes.fromUint8Array(combined)));

  const transfer = new TransferEvent(transferId);
  transfer.token = tTokenId;
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.tokenId = tId;
  transfer.transactionHash = event.transaction.hash;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.save();
}
