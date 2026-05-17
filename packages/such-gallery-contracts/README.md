# such.gallery — ERC-6551 NFT Gallery Contracts

Season 1: 30 galleries, one per day, Dutch auction. Each gallery NFT is a token-bound account (ERC-6551) that holds other NFTs. Owners deposit art and arrange it in a 3D generative gallery at such.gallery.

## Architecture

- **SuchGallery.sol** — ERC-721 with daily Dutch auction mint
- **GalleryMetadata.sol** — On-chain storage for parametric traits + art placement data
- Uses ERC-6551 registry (deployed singleton, no custom impl needed)
- Metadata served via tokenURI pointing to IPFS JSON with traits + placement array

## Key Concepts

- **Gallery NFT** = ERC-721 token with a 6551 token-bound account
- **Deposit** = transfer any NFT into the gallery's 6551 account
- **Withdraw** = gallery owner transfers NFTs out of the 6551 account
- **Placement** = on-chain mapping of deposited token → {position, rotation, scale}
- **Parametric traits** = wall color, floor material, lighting, trim — driven by token ID seed
- **Auction** = Dutch decay over 24h, one new gallery per day, 30 total

## Season 1 Parameters

- Supply: 30
- Mint: Dutch auction, one per day
- Start price: TBD (configurable)
- Reserve price: TBD (configurable)
- Royalty: 10% curator/creator
