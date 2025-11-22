// STPV2 Factory ABI
export const STPV2_FACTORY_ABI = [
  {
    "type": "function",
    "name": "deploySubscription",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "components": [
          { "name": "deployKey", "type": "bytes" },
          {
            "name": "initParams",
            "type": "tuple",
            "components": [
              { "name": "name", "type": "string" },
              { "name": "symbol", "type": "string" },
              { "name": "contractUri", "type": "string" },
              { "name": "owner", "type": "address" },
              { "name": "currencyAddress", "type": "address" },
              { "name": "globalSupplyCap", "type": "uint64" }
            ]
          },
          {
            "name": "tierParams",
            "type": "tuple",
            "components": [
              { "name": "periodDurationSeconds", "type": "uint32" },
              { "name": "maxSupply", "type": "uint32" },
              { "name": "maxCommitmentSeconds", "type": "uint48" },
              { "name": "startTimestamp", "type": "uint48" },
              { "name": "endTimestamp", "type": "uint48" },
              { "name": "rewardCurveId", "type": "uint8" },
              { "name": "rewardBasisPoints", "type": "uint16" },
              { "name": "paused", "type": "bool" },
              { "name": "transferrable", "type": "bool" },
              { "name": "initialMintPrice", "type": "uint256" },
              { "name": "pricePerPeriod", "type": "uint256" },
              {
                "name": "gate",
                "type": "tuple",
                "components": [
                  { "name": "gateType", "type": "uint8" },
                  { "name": "contractAddress", "type": "address" },
                  { "name": "componentId", "type": "uint256" },
                  { "name": "balanceMin", "type": "uint256" }
                ]
              }
            ]
          },
          {
            "name": "rewardParams",
            "type": "tuple",
            "components": [
              { "name": "slashable", "type": "bool" },
              { "name": "slashGracePeriod", "type": "uint48" }
            ]
          },
          {
            "name": "curveParams",
            "type": "tuple",
            "components": [
              { "name": "numPeriods", "type": "uint256" },
              { "name": "formulaBase", "type": "uint256" },
              { "name": "periodSeconds", "type": "uint256" }
            ]
          },
          { "name": "clientFeeBps", "type": "uint16" },
          { "name": "clientReferralShareBps", "type": "uint16" },
          { "name": "clientFeeRecipient", "type": "address" }
        ]
      }
    ],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "feeSchedule",
    "inputs": [],
    "outputs": [
      {
        "name": "schedule",
        "type": "tuple",
        "components": [
          { "name": "deployFee", "type": "uint256" },
          { "name": "protocolFeeBps", "type": "uint16" },
          { "name": "recipient", "type": "address" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Deployment",
    "inputs": [
      { "name": "deployment", "type": "address", "indexed": true },
      { "name": "deployKey", "type": "bytes", "indexed": false }
    ]
  }
] as const;

// STPV2 Contract ABI
export const STPV2_ABI = [
  {
    "type": "function",
    "name": "mint",
    "inputs": [{ "name": "numTokens", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "mintFor",
    "inputs": [
      { "name": "account", "type": "address" },
      { "name": "numTokens", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "mintAdvanced",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "components": [
          { "name": "tierId", "type": "uint16" },
          { "name": "recipient", "type": "address" },
          { "name": "referrer", "type": "address" },
          { "name": "referralCode", "type": "uint256" },
          { "name": "purchaseValue", "type": "uint256" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "subscriptionOf",
    "inputs": [{ "name": "account", "type": "address" }],
    "outputs": [
      {
        "name": "subscription",
        "type": "tuple",
        "components": [
          { "name": "tierId", "type": "uint16" },
          { "name": "tokenId", "type": "uint64" },
          { "name": "expiresAt", "type": "uint48" },
          { "name": "purchaseExpiresAt", "type": "uint48" },
          { "name": "rewardShares", "type": "uint256" },
          { "name": "rewardBalance", "type": "uint256" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tierDetail",
    "inputs": [{ "name": "tierId", "type": "uint16" }],
    "outputs": [
      {
        "name": "tier",
        "type": "tuple",
        "components": [
          {
            "name": "params",
            "type": "tuple",
            "components": [
              { "name": "periodDurationSeconds", "type": "uint32" },
              { "name": "maxSupply", "type": "uint32" },
              { "name": "maxCommitmentSeconds", "type": "uint48" },
              { "name": "startTimestamp", "type": "uint48" },
              { "name": "endTimestamp", "type": "uint48" },
              { "name": "rewardCurveId", "type": "uint8" },
              { "name": "rewardBasisPoints", "type": "uint16" },
              { "name": "paused", "type": "bool" },
              { "name": "transferrable", "type": "bool" },
              { "name": "initialMintPrice", "type": "uint256" },
              { "name": "pricePerPeriod", "type": "uint256" },
              {
                "name": "gate",
                "type": "tuple",
                "components": [
                  { "name": "gateType", "type": "uint8" },
                  { "name": "contractAddress", "type": "address" },
                  { "name": "componentId", "type": "uint256" },
                  { "name": "balanceMin", "type": "uint256" }
                ]
              }
            ]
          },
          { "name": "subCount", "type": "uint32" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "contractDetail",
    "inputs": [],
    "outputs": [
      {
        "name": "detail",
        "type": "tuple",
        "components": [
          { "name": "tierCount", "type": "uint16" },
          { "name": "subCount", "type": "uint64" },
          { "name": "supplyCap", "type": "uint64" },
          { "name": "transferRecipient", "type": "address" },
          { "name": "currency", "type": "address" },
          { "name": "creatorBalance", "type": "uint256" },
          { "name": "numCurves", "type": "uint8" },
          { "name": "rewardShares", "type": "uint256" },
          { "name": "rewardBalance", "type": "uint256" },
          { "name": "rewardSlashGracePeriod", "type": "uint48" },
          { "name": "rewardSlashable", "type": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferRewardsFor",
    "inputs": [{ "name": "account", "type": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createTier",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "components": [
          { "name": "periodDurationSeconds", "type": "uint32" },
          { "name": "maxSupply", "type": "uint32" },
          { "name": "maxCommitmentSeconds", "type": "uint48" },
          { "name": "startTimestamp", "type": "uint48" },
          { "name": "endTimestamp", "type": "uint48" },
          { "name": "rewardCurveId", "type": "uint8" },
          { "name": "rewardBasisPoints", "type": "uint16" },
          { "name": "paused", "type": "bool" },
          { "name": "transferrable", "type": "bool" },
          { "name": "initialMintPrice", "type": "uint256" },
          { "name": "pricePerPeriod", "type": "uint256" },
          {
            "name": "gate",
            "type": "tuple",
            "components": [
              { "name": "gateType", "type": "uint8" },
              { "name": "contractAddress", "type": "address" },
              { "name": "componentId", "type": "uint256" },
              { "name": "balanceMin", "type": "uint256" }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "grantTime",
    "inputs": [
      { "name": "account", "type": "address" },
      { "name": "numSeconds", "type": "uint48" },
      { "name": "tierId", "type": "uint16" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFunds",
    "inputs": [
      { "name": "to", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Mint",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "indexed": true },
      { "name": "account", "type": "address", "indexed": true },
      { "name": "tierId", "type": "uint16", "indexed": true }
    ]
  },
  {
    "type": "event",
    "name": "Renewed",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "indexed": true },
      { "name": "newExpiresAt", "type": "uint48", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "TierCreated",
    "inputs": [{ "name": "tierId", "type": "uint16", "indexed": true }]
  }
] as const;
