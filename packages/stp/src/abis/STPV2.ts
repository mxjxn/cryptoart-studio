export const STPV2ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Purchase',
    inputs: [
      { name: 'tokenId', type: 'uint64', indexed: true },
      { name: 'tokensTransferred', type: 'uint256', indexed: false },
      { name: 'timePurchased', type: 'uint48', indexed: false },
      { name: 'expiresAt', type: 'uint48', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Refund',
    inputs: [
      { name: 'tokenId', type: 'uint64', indexed: true },
      { name: 'tokensTransferred', type: 'uint256', indexed: false },
      { name: 'timeReclaimed', type: 'uint48', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Grant',
    inputs: [
      { name: 'tokenId', type: 'uint64', indexed: true },
      { name: 'secondsGranted', type: 'uint48', indexed: false },
      { name: 'expiresAt', type: 'uint48', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GrantRevoke',
    inputs: [
      { name: 'tokenId', type: 'uint64', indexed: true },
      { name: 'time', type: 'uint48', indexed: false },
      { name: 'expiresAt', type: 'uint48', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SwitchTier',
    inputs: [
      { name: 'tokenId', type: 'uint64', indexed: true },
      { name: 'oldTier', type: 'uint16', indexed: false },
      { name: 'newTier', type: 'uint16', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TierCreated',
    inputs: [{ name: 'tierId', type: 'uint16', indexed: false }],
  },
  {
    type: 'event',
    name: 'TierUpdated',
    inputs: [{ name: 'tierId', type: 'uint16', indexed: false }],
  },
  {
    type: 'event',
    name: 'SharesIssued',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'numShares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SharesBurned',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'numShares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReferralPayout',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'referrer', type: 'address', indexed: true },
      { name: 'referralId', type: 'uint256', indexed: true },
      { name: 'rewardAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'subscriptionOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'tierId', type: 'uint16' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'expiresAt', type: 'uint48' },
          { name: 'purchaseExpiresAt', type: 'uint48' },
          { name: 'rewardShares', type: 'uint256' },
          { name: 'rewardBalance', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'numSeconds', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tierBalanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'tierId', type: 'uint16' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: 'numSeconds', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tierDetail',
    stateMutability: 'view',
    inputs: [{ name: 'tierId', type: 'uint16' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'periodDurationSeconds', type: 'uint48' },
              { name: 'maxSupply', type: 'uint64' },
              { name: 'maxCommitmentSeconds', type: 'uint48' },
              { name: 'startTimestamp', type: 'uint48' },
              { name: 'endTimestamp', type: 'uint48' },
              { name: 'paused', type: 'bool' },
              { name: 'transferrable', type: 'bool' },
              { name: 'initialMintingAllowlistId', type: 'bytes32' },
              { name: 'rewardCurveId', type: 'uint8' },
              { name: 'rewardBasisPoints', type: 'uint16' },
            ],
          },
          { name: 'pricePerPeriod', type: 'uint256' },
          { name: 'subCount', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'contractDetail',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'tierCount', type: 'uint16' },
          { name: 'subCount', type: 'uint64' },
          { name: 'supplyCap', type: 'uint64' },
          { name: 'transferRecipient', type: 'address' },
          { name: 'currency', type: 'address' },
          { name: 'creatorBalance', type: 'uint256' },
          { name: 'numCurves', type: 'uint8' },
          { name: 'rewardShares', type: 'uint256' },
          { name: 'rewardBalance', type: 'uint256' },
          { name: 'rewardSlashGracePeriod', type: 'uint48' },
          { name: 'rewardSlashable', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'owner', type: 'address' }],
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'payable',
    inputs: [{ name: 'numTokens', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'mintFor',
    stateMutability: 'payable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'numTokens', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'mintAdvanced',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'tierId', type: 'uint16' },
          { name: 'purchaseValue', type: 'uint256' },
          { name: 'referralCode', type: 'uint256' },
          { name: 'referrer', type: 'address' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;
