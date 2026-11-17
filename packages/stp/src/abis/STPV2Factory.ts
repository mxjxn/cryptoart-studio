export const STPV2FactoryABI = [
  {
    type: 'event',
    name: 'Deployment',
    inputs: [
      { name: 'deployment', type: 'address', indexed: true },
      { name: 'deployKey', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DeployFeeTransfer',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DeployFeeChange',
    inputs: [{ name: 'amount', type: 'uint256', indexed: false }],
  },
  {
    type: 'event',
    name: 'ProtocolFeeRecipientChange',
    inputs: [{ name: 'account', type: 'address', indexed: false }],
  },
  {
    type: 'function',
    name: 'deploySubscription',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          {
            name: 'initParams',
            type: 'tuple',
            components: [
              { name: 'owner', type: 'address' },
              { name: 'currencyAddress', type: 'address' },
              { name: 'contractUri', type: 'string' },
              { name: 'name', type: 'string' },
              { name: 'symbol', type: 'string' },
              { name: 'globalSupplyCap', type: 'uint64' },
            ],
          },
          {
            name: 'tierParams',
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
              { name: 'pricePerPeriod', type: 'uint256' },
            ],
          },
          {
            name: 'rewardParams',
            type: 'tuple',
            components: [
              { name: 'slashGracePeriod', type: 'uint48' },
              { name: 'slashable', type: 'bool' },
            ],
          },
          {
            name: 'curveParams',
            type: 'tuple',
            components: [
              { name: 'numPeriods', type: 'uint16' },
              { name: 'formulaBase', type: 'uint64' },
              { name: 'periodSeconds', type: 'uint48' },
            ],
          },
          { name: 'clientFeeRecipient', type: 'address' },
          { name: 'clientFeeBps', type: 'uint16' },
          { name: 'clientReferralShareBps', type: 'uint16' },
          { name: 'deployKey', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'feeSchedule',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'deployFee', type: 'uint256' },
          { name: 'protocolFeeBps', type: 'uint16' },
          { name: 'recipient', type: 'address' },
        ],
      },
    ],
  },
] as const;
