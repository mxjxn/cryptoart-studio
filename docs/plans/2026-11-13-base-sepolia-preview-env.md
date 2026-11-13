# Base Sepolia preview factory env (2026-11-13)

Public on-chain addresses from tonight’s preview deploy. **Not secrets.**

```
CHAIN_84532_FACTORY_ADDRESS=0xB25A4fcad3DbC9713116A84F975E90dE37416155
CHAIN_84532_ERC1155_FACTORY_ADDRESS=0xAe92d913c1eEdD548b5afa508B6369F0FEf5aF2d
CHAIN_84532_START_BLOCK=58162104
```

| | |
|--|--|
| Owner | `0x9F8679C8F662fdF09654FE73BD3702eDeeD1B9f3` |
| ERC-721 factory tx | `0x5f19824dd6386a58fd0164353f6c09f29b7ca6f6590a99784a66d94ae849795b` |
| ERC-1155 factory tx | `0x25836a5c996b033a55fe18d659d548f34956dccb3693cddbf5246ced7ed915ba` |
| Artifact | `packages/collection-contracts/deployments/base-sepolia.json` |
| Vercel project | `cryptoart-studio` → domain `cryptoart.studio` |
| Latest prod URL | `https://cryptoart-studio-79zrejwta-max-jacksons-projects-045a7996.vercel.app` |

## Vercel

These four vars are already set on Production / Preview / Development for `cryptoart-studio`:

- `CHAIN_84532_FACTORY_ADDRESS`
- `CHAIN_84532_ERC1155_FACTORY_ADDRESS`
- `CHAIN_84532_START_BLOCK`
- `CHAIN_84532_RPC_URL`

### DNS (required for apex)

Domain is attached; registrar nameservers are not on Vercel yet. Either:

- **Recommended:** `A` record `cryptoart.studio` → `76.76.21.21`
- Or nameservers `ns1.vercel-dns.com` / `ns2.vercel-dns.com`

Then: `vercel domains verify cryptoart.studio`.

### Local smoke

Export the same `CHAIN_84532_*` vars in the shell that runs `apps/studio`, then open Collections → New → Base Sepolia.
