import { createConfig } from "ponder";
import { http } from "viem";

import { MarketplaceLibAbi } from "./abis/MarketplaceLib";
import { SettlementLibAbi } from "./abis/SettlementLib";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453,
    },
  },
  contracts: {
    // MarketplaceCore contract - main contract using MarketplaceLib ABI
    // Note: Using MarketplaceLib ABI because library events are emitted from this contract
    MarketplaceCore: {
      chain: "base",
      abi: MarketplaceLibAbi,
      address: "0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9",
      startBlock: 38886000, // Just before first auction (tx at block 38886751)
    },
    // SettlementLib events - same contract address for library events
    SettlementLib: {
      chain: "base",
      abi: SettlementLibAbi,
      address: "0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9",
      startBlock: 38886000, // Just before first auction (tx at block 38886751)
    },
  },
});
