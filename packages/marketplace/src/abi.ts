export const MARKETPLACE_ABI = [
  {
    type: 'function',
    name: 'getListing',
    inputs: [{ name: 'listingId', type: 'uint40' }],
    outputs: [{
      name: '', type: 'tuple', components: [
        { name: 'id', type: 'uint256' },
        { name: 'seller', type: 'address' },
        { name: 'finalized', type: 'bool' },
        { name: 'totalSold', type: 'uint24' },
        { name: 'marketplaceBPS', type: 'uint16' },
        { name: 'referrerBPS', type: 'uint16' },
        { name: 'details', type: 'tuple', components: [
          { name: 'initialAmount', type: 'uint256' },
          { name: 'type_', type: 'uint8' },
          { name: 'totalAvailable', type: 'uint24' },
          { name: 'totalPerSale', type: 'uint24' },
          { name: 'extensionInterval', type: 'uint16' },
          { name: 'minIncrementBPS', type: 'uint16' },
          { name: 'erc20', type: 'address' },
          { name: 'identityVerifier', type: 'address' },
          { name: 'startTime', type: 'uint48' },
          { name: 'endTime', type: 'uint48' },
        ]},
        { name: 'token', type: 'tuple', components: [
          { name: 'id', type: 'uint256' },
          { name: 'address_', type: 'address' },
          { name: 'spec', type: 'uint8' },
          { name: 'lazy', type: 'bool' },
        ]},
        { name: 'receivers', type: 'tuple[]', components: [
          { name: 'receiver', type: 'address' },
          { name: 'receiverBPS', type: 'uint16' },
        ]},
        { name: 'fees', type: 'tuple', components: [
          { name: 'deliverBPS', type: 'uint16' },
          { name: 'deliverFixed', type: 'uint240' },
        ]},
        { name: 'bid', type: 'tuple', components: [
          { name: 'amount', type: 'uint256' },
          { name: 'bidder', type: 'address' },
          { name: 'delivered', type: 'bool' },
          { name: 'settled', type: 'bool' },
          { name: 'refunded', type: 'bool' },
          { name: 'timestamp', type: 'uint48' },
          { name: 'referrer', type: 'address' },
        ]},
        { name: 'offersAccepted', type: 'bool' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getListingCurrentPrice',
    inputs: [{ name: 'listingId', type: 'uint40' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bid',
    inputs: [
      { name: 'listingId', type: 'uint40' },
      { name: 'increase', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'purchase',
    inputs: [
      { name: 'listingId', type: 'uint40' },
      { name: 'count', type: 'uint24' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      { name: 'listingId', type: 'uint40' },
      { name: 'holdbackBPS', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'finalize',
    inputs: [{ name: 'listingId', type: 'uint40' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'createListing',
    inputs: [
      { name: 'listingDetails', type: 'tuple', components: [
        { name: 'initialAmount', type: 'uint256' },
        { name: 'type_', type: 'uint8' },
        { name: 'totalAvailable', type: 'uint24' },
        { name: 'totalPerSale', type: 'uint24' },
        { name: 'extensionInterval', type: 'uint16' },
        { name: 'minIncrementBPS', type: 'uint16' },
        { name: 'erc20', type: 'address' },
        { name: 'identityVerifier', type: 'address' },
        { name: 'startTime', type: 'uint48' },
        { name: 'endTime', type: 'uint48' },
      ]},
      { name: 'tokenDetails', type: 'tuple', components: [
        { name: 'id', type: 'uint256' },
        { name: 'address_', type: 'address' },
        { name: 'spec', type: 'uint8' },
        { name: 'lazy', type: 'bool' },
      ]},
      { name: 'deliveryFees', type: 'tuple', components: [
        { name: 'deliverBPS', type: 'uint16' },
        { name: 'deliverFixed', type: 'uint240' },
      ]},
      { name: 'listingReceivers', type: 'tuple[]', components: [
        { name: 'receiver', type: 'address' },
        { name: 'receiverBPS', type: 'uint16' },
      ]},
      { name: 'enableReferrer', type: 'bool' },
      { name: 'acceptOffers', type: 'bool' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'uint40' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isAdmin',
    inputs: [{ name: 'admin', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export const ERC20_ABI = [
  { type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
] as const;

export const NFT_APPROVAL_ABI = [
  { type: 'function', name: 'setApprovalForAll', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'isApprovedForAll', inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
] as const;
