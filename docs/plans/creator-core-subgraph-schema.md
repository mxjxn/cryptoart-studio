# Creator-Core Subgraph Schema

## Entities

### CreatorContract
One per deployed ERC721Creator / ERC1155Creator instance.

```
type CreatorContract @entity {
  id: Bytes!              # contract address
  creator: Bytes!         # deployer / owner (msg.sender on ExtensionRegistered)
  tokenStandard: String!  # "ERC721" | "ERC1155"
  extensions: [Extension!]! @derivedFrom(field: "contract")
  tokens: [Token!]! @derivedFrom(field: "collection")
  defaultRoyaltyReceiver: Bytes
  defaultRoyaltyBPS: BigInt
  totalSupply: BigInt!
  createdAt: BigInt!      # block timestamp of first interaction
}
```

> **Note:** There's no factory-level `CreatorDeployed` event. The proxy is Yul-only (DeploymentProxy.yul).
> Detection strategy: index `Transfer(from=0x0)` mints OR `ExtensionRegistered` events and backfill
> the contract entity on first sight. Token standard determined by checking ERC165 interface support
> at indexing time, or by which event signatures appear.

---

### Extension
Tracks registered/unregistered/blacklisted extensions per contract.

```
type Extension @entity {
  id: Bytes!              # keccak256(contractAddress, extensionAddress)
  contract: CreatorContract!
  extensionAddress: Bytes!
  sender: Bytes!          # who registered it
  status: String!         # "active" | "unregistered" | "blacklisted"
  mintPermissions: Bytes  # address of permissions contract (from MintPermissionsUpdated)
  approveTransfer: Boolean # from ExtensionApproveTransferUpdated
  registeredAt: BigInt!
  updatedAt: BigInt!
}
```

**Events handled:**
- `ExtensionRegistered(address extension, address sender)` → create, status=active
- `ExtensionUnregistered(address extension, address sender)` → status=unregistered
- `ExtensionBlacklisted(address extension, address sender)` → status=blacklisted
- `MintPermissionsUpdated(address extension, address permissions, address sender)` → update mintPermissions
- `ExtensionApproveTransferUpdated(address extension, bool enabled)` → update approveTransfer

---

### Token
One per minted NFT.

```
type Token @entity {
  id: Bytes!              # keccak256(collectionAddress, tokenId)
  collection: CreatorContract!
  tokenId: BigInt!
  owner: Bytes!
  mintedBy: Bytes!        # to address from Transfer(address(0), to, tokenId)
  mintedAt: BigInt!       # block timestamp
  tokenURI: String
  burnt: Boolean!
}
```

**Events handled:**
- ERC721: `Transfer(address(0), to, tokenId)` → mint
- ERC721: `Transfer(owner, address(0), tokenId)` → burn (set burnt=true)
- ERC721: `Transfer(from, to, tokenId)` → ownership change
- ERC1155: `TransferSingle(operator, address(0), to, id, amount)` → mint
- ERC1155: `TransferBatch(operator, address(0), to, ids, amounts)` → batch mint

---

### RoyaltyOverride
Per-token or per-extension royalty overrides.

```
type RoyaltyOverride @entity {
  id: Bytes!              # keccak256(contractAddress, tokenId or "default" or extensionAddress)
  contract: CreatorContract!
  scope: String!          # "default" | "token" | "extension"
  tokenId: BigInt         # null for default/extension scope
  extension: Bytes        # null for default/token scope
  receivers: [Bytes!]!
  basisPoints: [BigInt!]!
  updatedAt: BigInt!
}
```

**Events handled:**
- `DefaultRoyaltiesUpdated(receivers, basisPoints)` → scope=default
- `RoyaltiesUpdated(tokenId, receivers, basisPoints)` → scope=token
- `ExtensionRoyaltiesUpdated(extension, receivers, basisPoints)` → scope=extension

---

### TransferEvent
Raw transfer log for activity feeds and provenance.

```
type TransferEvent @entity {
  id: Bytes!              # keccak256(txHash, logIndex)
  token: Token!
  from: Bytes!
  to: Bytes!
  tokenId: BigInt!
  operator: Bytes         # ERC1155 operator
  amount: BigInt          # ERC1155 amount (1 for ERC721)
  transactionHash: Bytes!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
}
```

---

## Event Mapping Summary

| Event | Entity Created/Updated |
|-------|----------------------|
| `Transfer(0x0, to, id)` (ERC721) | Token (mint) + CreatorContract.totalSupply++ |
| `Transfer(from, 0x0, id)` (ERC721) | Token (burn) + CreatorContract.totalSupply-- |
| `Transfer(from, to, id)` (ERC721) | Token.owner + TransferEvent |
| `TransferSingle(...)` (ERC1155) | Token + TransferEvent |
| `TransferBatch(...)` (ERC1155) | Token[] + TransferEvent[] |
| `ExtensionRegistered` | Extension (create) + CreatorContract (upsert) |
| `ExtensionUnregistered` | Extension.status |
| `ExtensionBlacklisted` | Extension.status |
| `MintPermissionsUpdated` | Extension.mintPermissions |
| `ExtensionApproveTransferUpdated` | Extension.approveTransfer |
| `DefaultRoyaltiesUpdated` | RoyaltyOverride (default) |
| `RoyaltiesUpdated` | RoyaltyOverride (token) |
| `ExtensionRoyaltiesUpdated` | RoyaltyOverride (extension) |

---

## Open Questions

1. **Contract discovery** — No factory event. Options:
   - Index all `ExtensionRegistered` events across all addresses → create CreatorContract on first hit
   - Maintain a registry of known creator contracts in the app backend
   - Add a custom `CreatorDeployed` event in our fork (breaks upstream compat)

2. **Token standard detection** — ERC165 check at index time, or infer from event signature?

3. **Separate subgraph or extend existing?** — Marketplace subgraph already exists. Could add these entities there, or run a dedicated creator-core subgraph and reference marketplace data cross-subgraph.
