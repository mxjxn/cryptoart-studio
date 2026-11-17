// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

/**
 * @title IMarketplaceCore
 * @notice Minimal marketplace surface used by SuchCollection lazy delivery.
 * @dev Struct layouts match the auction-house `getListing` ABI so collections can
 *      call the live MarketplaceCore and mock marketplaces interchangeably.
 */
interface IMarketplaceCore {
    struct ListingDetails {
        uint256 initialAmount;
        uint8 type_;
        uint24 totalAvailable;
        uint24 totalPerSale;
        uint16 extensionInterval;
        uint16 minIncrementBPS;
        address erc20;
        address identityVerifier;
        uint48 startTime;
        uint48 endTime;
    }

    struct TokenDetails {
        uint256 id;
        address address_;
        uint8 spec;
        bool lazy;
    }

    struct ListingReceiver {
        address payable receiver;
        uint16 receiverBPS;
    }

    struct DeliveryFees {
        uint16 deliverBPS;
        uint240 deliverFixed;
    }

    struct Bid {
        uint256 amount;
        address payable bidder;
        bool delivered;
        bool settled;
        bool refunded;
        uint48 timestamp;
        address payable referrer;
    }

    struct Listing {
        uint256 id;
        address payable seller;
        bool finalized;
        uint24 totalSold;
        uint16 marketplaceBPS;
        uint16 referrerBPS;
        ListingDetails details;
        TokenDetails token;
        ListingReceiver[] receivers;
        DeliveryFees fees;
        Bid bid;
        bool offersAccepted;
    }

    function getListing(uint40 listingId) external view returns (Listing memory);
}
