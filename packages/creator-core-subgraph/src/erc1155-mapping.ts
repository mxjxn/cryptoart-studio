import { crypto, Bytes, BigInt } from "@graphprotocol/graph-ts";
import {
  TransferSingle,
  TransferBatch,
} from "../generated/ERC1155Creator/ERC1155";
import {
  CreatorContract,
  Token,
  TransferEvent,
} from "../generated/schema";

function makeTokenId(collection: Bytes, tId: BigInt): Bytes {
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
    contract.tokenStandard = "ERC1155";
    contract.totalSupply = BigInt.fromI32(0);
    contract.createdAt = timestamp;
    contract.save();
  }
}

function handleSingleTransfer(
  contractAddr: Bytes,
  tId: BigInt,
  from: Bytes,
  to: Bytes,
  amount: BigInt,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  blockTimestamp: BigInt,
): void {
  ensureCreatorContract(contractAddr, blockTimestamp);

  const entityTokenId = makeTokenId(contractAddr, tId);
  let token = Token.load(entityTokenId);
  if (token == null) {
    token = new Token(entityTokenId);
    token.collection = contractAddr;
    token.tokenId = tId;
    token.owner = to;
    token.mintedBy = from;
    token.mintedAt = blockTimestamp;
    token.burnt = false;
    token.save();
  } else {
    token.owner = to;
    token.save();
  }

  const logIndexBytes = Bytes.fromBigInt(logIndex);
  const combined = new Uint8Array(txHash.length + logIndexBytes.length);
  combined.set(txHash, 0);
  combined.set(logIndexBytes, txHash.length);
  const transferId = Bytes.fromByteArray(crypto.keccak256(Bytes.fromUint8Array(combined)));

  const transfer = new TransferEvent(transferId);
  transfer.token = entityTokenId;
  transfer.from = from;
  transfer.to = to;
  transfer.tokenId = tId;
  transfer.amount = amount;
  transfer.transactionHash = txHash;
  transfer.blockNumber = blockNumber;
  transfer.blockTimestamp = blockTimestamp;
  transfer.save();
}

export function handleTransferSingle(event: TransferSingle): void {
  handleSingleTransfer(
    event.address,
    event.params.id,
    event.params.from,
    event.params.to,
    event.params.value,
    event.transaction.hash,
    BigInt.fromI32(event.logIndex.toI32()),
    event.block.number,
    event.block.timestamp,
  );
}

export function handleTransferBatch(event: TransferBatch): void {
  const ids = event.params.ids;
  const values = event.params.values;
  for (let i = 0; i < ids.length; i++) {
    handleSingleTransfer(
      event.address,
      ids[i],
      event.params.from,
      event.params.to,
      values[i],
      event.transaction.hash,
      BigInt.fromI32(event.logIndex.toI32()).plus(BigInt.fromI32(i)),
      event.block.number,
      event.block.timestamp,
    );
  }
}
