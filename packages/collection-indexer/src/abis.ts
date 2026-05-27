export const FACTORY_EVENTS = [
  {
    type: 'event',
    name: 'CollectionCreated',
    inputs: [
      { name: 'collection', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
] as const;

export const COLLECTION_EVENTS = [
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
    name: 'Minted',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'tokenURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ExtensionRegistered',
    inputs: [
      { name: 'extension', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ExtensionUnregistered',
    inputs: [
      { name: 'extension', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'RoyaltyUpdated',
    inputs: [
      { name: 'receiver', type: 'address', indexed: false },
      { name: 'bps', type: 'uint16', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BaseURIUpdated',
    inputs: [
      { name: 'baseURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
] as const;

export const COLLECTION_READ_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  {
    name: 'getRoyalties',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'receivers', type: 'address[]' },
      { name: 'basisPoints', type: 'uint256[]' },
    ],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;
