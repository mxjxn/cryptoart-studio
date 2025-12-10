// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title IMarketplace
 * @notice Interface for the CryptoArt Studio marketplace
 * @dev Matches the existing auctionhouse contract interface
 */
interface IMarketplace {
    /// @notice Listing types supported by the marketplace
    enum ListingType {
        NONE,
        INDIVIDUAL_AUCTION,
        FIXED_PRICE,
        DYNAMIC_PRICE,
        OFFERS_ONLY
    }

    /// @notice Token specification
    enum TokenSpec {
        ERC721,
        ERC1155
    }

    /// @notice Listing data structure
    struct Listing {
        uint40 listingId;
        address seller;
        address tokenAddress;
        uint256 tokenId;
        TokenSpec tokenSpec;
        uint256 amount; // For ERC1155
        ListingType listingType;
        address erc20; // Payment token (address(0) = ETH)
        uint256 initialAmount;
        uint256 minIncrementBps;
        uint40 startTime;
        uint40 endTime;
        uint40 extensionInterval;
        bool finalized;
    }

    /**
     * @notice Place a bid on an auction listing
     * @param listingId The listing ID to bid on
     * @param increase Whether to increase the current bid or bid exact amount
     */
    function bid(uint40 listingId, bool increase) external payable;

    /**
     * @notice Place a bid with a referrer
     * @param referrer Address to receive referral fees
     * @param listingId The listing ID to bid on
     * @param increase Whether to increase the current bid or bid exact amount
     */
    function bid(address referrer, uint40 listingId, bool increase) external payable;

    /**
     * @notice Place a bid with specific amount and referrer
     * @param referrer Address to receive referral fees
     * @param listingId The listing ID to bid on
     * @param bidAmount The amount to bid
     * @param increase Whether to increase the current bid
     */
    function bid(
        address referrer,
        uint40 listingId,
        uint256 bidAmount,
        bool increase
    ) external payable;

    /**
     * @notice Purchase a fixed-price listing
     * @param listingId The listing ID to purchase
     */
    function purchase(uint40 listingId) external payable;

    /**
     * @notice Purchase with referrer
     * @param referrer Address to receive referral fees
     * @param listingId The listing ID to purchase
     */
    function purchase(address referrer, uint40 listingId) external payable;

    /**
     * @notice Create an offer on a listing
     * @param listingId The listing ID
     * @param amount The offer amount
     * @param erc20 The payment token (address(0) = ETH)
     * @param expirationTime When the offer expires
     */
    function createOffer(
        uint40 listingId,
        uint256 amount,
        address erc20,
        uint40 expirationTime
    ) external payable;

    /**
     * @notice Create a new listing
     * @param tokenAddress The NFT contract address
     * @param tokenId The NFT token ID
     * @param tokenSpec ERC721 or ERC1155
     * @param amount Amount for ERC1155 (1 for ERC721)
     * @param listingType Type of listing
     * @param initialAmount Starting price/reserve
     * @param erc20 Payment token
     * @param startTime When listing starts
     * @param endTime When listing ends
     * @return listingId The created listing ID
     */
    function createListing(
        address tokenAddress,
        uint256 tokenId,
        TokenSpec tokenSpec,
        uint256 amount,
        ListingType listingType,
        uint256 initialAmount,
        address erc20,
        uint40 startTime,
        uint40 endTime
    ) external returns (uint40 listingId);

    /**
     * @notice Cancel a listing
     * @param listingId The listing to cancel
     */
    function cancelListing(uint40 listingId) external;

    /**
     * @notice Finalize an ended auction
     * @param listingId The listing to finalize
     */
    function finalize(uint40 listingId) external;

    /**
     * @notice Accept an offer on a listing
     * @param listingId The listing ID
     * @param offerId The offer ID to accept
     */
    function acceptOffer(uint40 listingId, uint256 offerId) external;

    /**
     * @notice Get listing details
     * @param listingId The listing ID
     * @return The listing data
     */
    function getListing(uint40 listingId) external view returns (Listing memory);

    /**
     * @notice Get the current highest bid
     * @param listingId The listing ID
     * @return bidder The highest bidder
     * @return amount The highest bid amount
     */
    function getHighestBid(
        uint40 listingId
    ) external view returns (address bidder, uint256 amount);
}
