module.exports = {
  // Network configuration
  rpcUrls: [
    'https://base-mainnet.g.alchemy.com/v2/1BOysSiEeMkfqD7oigy9qvPIcDzsnT6o'
  ],

  // Alchemy API Key (from environment variables or hardcoded)
  alchemyApiKey: process.env.ALCHEMY_API_KEY || '1BOysSiEeMkfqD7oigy9qvPIcDzsnT6o',

  // Contract addresses
  marketplaceAddress: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9',

  // Marketplace ABI based on MarketplaceLib events
  marketplaceAbi: [
    // Admin configuration events - using exact signatures from the 3 transactions
    // These events are emitted by library functions, not in main contract ABI
    'event SetFees(address,uint16,uint16)',
    'event SetRoyaltyEnforcement(address)',
    'event SetSellerRegistration(address,address)',

    // Events from MarketplaceLib
    'event CreateListing(uint40 indexed listingId, uint16 marketplaceBPS, uint16 referrerBPS, uint8 listingType, uint24 totalAvailable, uint24 totalPerSale, uint48 startTime, uint48 endTime, uint256 initialAmount, uint16 extensionInterval, uint16 minIncrementBPS, address erc20, address identityVerifier)',
    'event CreateListingTokenDetails(uint40 indexed listingId, uint256 id, address address_, uint8 spec, bool lazy)',
    'event CreateListingFees(uint40 indexed listingId, uint16 deliverBPS, uint240 deliverFixed)',
    'event PurchaseEvent(uint40 indexed listingId, address referrer, address buyer, uint24 count, uint256 amount)',
    'event BidEvent(uint40 indexed listingId, address referrer, address bidder, uint256 amount)',
    'event OfferEvent(uint40 indexed listingId, address referrer, address oferrer, uint256 amount)',
    'event RescindOfferEvent(uint40 indexed listingId, address oferrer, uint256 amount)',
    'event AcceptOfferEvent(uint40 indexed listingId, address oferrer, uint256 amount)',
    'event ModifyListing(uint40 indexed listingId, uint256 initialAmount, uint48 startTime, uint48 endTime)',
    'event CancelListing(uint40 indexed listingId, address requestor, uint16 holdbackBPS)',
    'event FinalizeListing(uint40 indexed listingId)'
  ],

  // Batch settings
  maxBlockRange: 10, // Free tier Alchemy limit

  // Retry settings
  maxRetries: 5,
  retryDelay: 2000 // 2 seconds
};
