# GenerativeParametersExtension (local deploy — Max)

Not deployed by CI. After `forge test` in `packages/collection-contracts`:

```bash
cd packages/collection-contracts
forge script script/DeployGenerativeExtension.s.sol --rpc-url <RPC> --broadcast
```

Or deploy manually:

1. `new GenerativeParametersExtension(collectionAddress, artistOwner)`
2. `SuchCollection.registerExtension(extensionAddress, "")`
3. Mint with `GenerativeParametersExtension.mint(collector, arMetadataUri, paramsBlob)`

See `docs/generative-html-nfts.md` for URL vs RPC metadata strategy.