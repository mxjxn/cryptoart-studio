// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {IMarketplaceCore} from "../../src/interfaces/IMarketplaceCore.sol";
import {ILazyDelivery} from "../../src/interfaces/ILazyDelivery.sol";

/**
 * @title MockMarketplace
 * @notice Realistic marketplace mock: global sequential listing IDs, anyone can create
 *         lazy listings (seller = msg.sender). Used to prove unauthorized / front-run
 *         listings cannot deliver on SuchCollection.
 */
contract MockMarketplace is IMarketplaceCore {
    uint40 public nextListingId = 1;

    struct StoredListing {
        address payable seller;
        address token;
        bool lazy;
        bool exists;
    }

    mapping(uint40 => StoredListing) private _listings;

    /**
     * @notice Create a lazy listing. Listing IDs come from a global counter — anyone
     *         can call this and become the seller of the next ID.
     */
    function createLazyListing(address token) external returns (uint40 listingId) {
        listingId = nextListingId++;
        _listings[listingId] = StoredListing({
            seller: payable(msg.sender),
            token: token,
            lazy: true,
            exists: true
        });
    }

    function getListing(uint40 listingId) external view override returns (Listing memory listing) {
        StoredListing storage stored = _listings[listingId];
        require(stored.exists, "Listing does not exist");

        listing.id = listingId;
        listing.seller = stored.seller;
        listing.token.id = 0;
        listing.token.address_ = stored.token;
        listing.token.spec = 0;
        listing.token.lazy = stored.lazy;
        // Remaining fields left at zero / empty
    }

    /**
     * @notice Simulate settlement calling deliver on a collection
     */
    function settle(
        address collection,
        uint40 listingId,
        address to,
        uint256 assetId,
        uint24 payableCount
    ) external {
        ILazyDelivery(collection).deliver(listingId, to, assetId, payableCount, 0, address(0), 0);
    }
}
