# Contract Addresses

This document contains all contract addresses used across the cryptoart monorepo. For detailed deployment information, see the individual package documentation.

## Base Mainnet (Chain ID: 8453)

### Auctionhouse Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| Marketplace (Proxy) | `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9` | Main auctionhouse marketplace contract |

**Links:**
- [Marketplace on BaseScan](https://basescan.org/address/0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9)

### LSSVM Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| LSSVM Router | `0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C` | Main router for LSSVM pool operations |
| LSSVM Factory | `0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e` | Factory for creating LSSVM pools |
| Bonding Curve - LINEAR | `0xe41352CB8D9af18231E05520751840559C2a548A` | Linear bonding curve implementation |
| Bonding Curve - EXPONENTIAL | `0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6` | Exponential bonding curve implementation |
| Bonding Curve - XYK | `0xd0A2f4ae5E816ec09374c67F6532063B60dE037B` | XYK bonding curve implementation |
| Bonding Curve - GDA | `0x4f1627be4C72aEB9565D4c751550C4D262a96B51` | GDA bonding curve implementation |

**Links:**
- [LSSVM Router on BaseScan](https://basescan.org/address/0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C)
- [LSSVM Factory on BaseScan](https://basescan.org/address/0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e)

**Subgraph:**
- LSSVM Subgraph: `https://api.studio.thegraph.com/query/5440/such-lssvm/0.0.1`

---

## Base Sepolia Testnet (Chain ID: 84532)

### Creator Core Contracts

#### Radical Testers Collection

| Contract | Address | Type |
|----------|---------|------|
| Collection (Proxy) | `0x6302C5F1F2E3d0e4D5ae5aeB88bd8044c88Eef9A` | TransparentUpgradeableProxy |
| Implementation | `0x0C1f9d0b4b92411B145E70A33052AE87D19e99c4` | ERC721CreatorImplementation |
| ProxyAdmin | `0xDF6c66d24C6DDBC9CcfDc74A243E8e098981a26E` | ProxyAdmin |

**Collection Details:**
- **Name**: Radical Testers
- **Symbol**: RT
- **Total Supply**: 100 NFTs
- **Owner**: `0x6dA173B1d50F7Bc5c686f8880C20378965408344`

**Links:**
- [Collection on BaseScan](https://sepolia.basescan.org/address/0x6302C5F1F2E3d0e4D5ae5aeB88bd8044c88Eef9A)
- [Implementation on BaseScan](https://sepolia.basescan.org/address/0x0C1f9d0b4b92411B145E70A33052AE87D19e99c4)
- [ProxyAdmin on BaseScan](https://sepolia.basescan.org/address/0xDF6c66d24C6DDBC9CcfDc74A243E8e098981a26E)

### LSSVM Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| LSSVM Router | `0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3` | Main router for LSSVM pool operations |
| LSSVM Factory | `0x372990Fd91CF61967325dD5270f50c4192bfb892` | Factory for creating LSSVM pools |

**Subgraph:**
- LSSVM Subgraph: `https://api.studio.thegraph.com/query/5440/such-lssvm-sepolia/0.0.1`

---

## Ethereum Mainnet (Chain ID: 1)

### Manifold Extension Contracts

These are shared extension contracts that can be installed by any Manifold Creator Core contract.

#### Manifold ERC721 Edition
Provides efficient batch minting for ERC721 NFTs.

| Network | Address |
|---------|---------|
| Mainnet | `0xc68afc6A3B47b108Db5e48fB53a10D2D9c11b094` |

#### Manifold Lazy Claim
Claim Page extensions for minting NFTs.

| Network | Spec | Address |
|---------|------|---------|
| Mainnet | ERC721 | `0x1EB73FEE2090fB1C20105d5Ba887e3c3bA14a17E` |
| Mainnet | ERC1155 | `0xDb8d79C775452a3929b86ac5DEaB3e9d38e1c006` |

#### Manifold Burn Redeem
Burn Redeem extensions for burning NFTs to redeem new ones.

| Network | Output Token Spec | Address |
|---------|-------------------|---------|
| Mainnet | ERC721 | `0xd391032fec8877953C51399C7c77fBcc93eE3E2A` |
| Mainnet | ERC1155 | `0xde659726CfD166aCa4867994d396EFeF386EAD68` |

#### OperatorFilterer
Shared extension to support OpenSea's Operator Filter Registry.

| Network | Address |
|---------|---------|
| Mainnet | `0x1dE06D2875453a272628BbB957077d18eb4A84CD` |

#### CreatorOperatorFilterer
Shared extension for Creator Controlled operator filters.

| Network | Address |
|---------|---------|
| Mainnet | `0x3E31CB740351D8650b36e8Ece95A8Efcd1fc28C2` |

---

## Goerli Testnet (Chain ID: 5)

### Manifold Extension Contracts

#### Manifold ERC721 Edition

| Network | Address |
|---------|---------|
| Goerli | `0x9cac159ec266E76ed7377b801f3b5d2cC7bcf40d` |

#### Manifold Lazy Claim

| Network | Spec | Address |
|---------|------|---------|
| Goerli | ERC721 | `0x074eaee8fc3e4e2b361762253f83d9a94aec6fd4` |
| Goerli | ERC1155 | `0x73CA7420625d312d1792Cea60Ced7B35D009322c` |

#### Manifold Burn Redeem

| Network | Output Token Spec | Address |
|---------|-------------------|---------|
| Goerli | ERC721 | `0x1aebd9fb121f33c37bbc6054ca50862249a39f66` |
| Goerli | ERC1155 | `0x193bFD86F329508351ae899A92a963d5bfC77190` |

#### OperatorFilterer

| Network | Address |
|---------|---------|
| Goerli | `0x851b63Bf5f575eA68A84baa5Ff9174172E4d7838` |

#### CreatorOperatorFilterer

| Network | Address |
|---------|---------|
| Goerli | `0x1CCCeFAD6E9a3226C2A218662EdF7D465D184893` |

---

## Notes

- **Proxy Pattern**: Creator Core contracts use a proxy pattern (Proxy, Implementation, ProxyAdmin). Only the Proxy address is needed for normal operations.
- **Extension Contracts**: Manifold extension contracts are shared instances that can be installed by any Creator Core contract.
- **LSSVM**: LSSVM (Liquidity-Sensitive Single-Variant Market) pools enable royalties, pool fees, and reselling at current price.
- **Network IDs**: Always verify the chain ID when interacting with contracts to avoid cross-chain mistakes.

## Related Documentation

- [LSSVM Integration Guide](./LSSVM_INTEGRATION.md) - Detailed LSSVM integration documentation
- [Creator Core Deployments](./packages/creator-core-contracts/DEPLOYMENTS.md) - Detailed deployment information
- [Auctionhouse Contracts](./packages/auctionhouse-contracts/README.md) - Auctionhouse contract documentation

