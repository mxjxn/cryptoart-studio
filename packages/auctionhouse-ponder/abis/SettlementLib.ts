export const SettlementLibAbi = [
  {
    type: "event",
    name: "Escrow",
    inputs: [
      { name: "receiver", type: "address", indexed: true, internalType: "address" },
      { name: "erc20", type: "address", indexed: false, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;
