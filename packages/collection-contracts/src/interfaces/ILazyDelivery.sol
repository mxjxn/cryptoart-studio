// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {IERC165} from "openzeppelin/utils/introspection/IERC165.sol";

/**
 * @title ILazyDelivery
 * @notice Interface for lazy minting and delivery through marketplace/auction house contracts
 * @dev Contracts implementing this interface can support lazy listings where tokens are minted
 *      on-demand when a buyer purchases them through the marketplace.
 */
interface ILazyDelivery is IERC165 {
    /**
     * @notice Deliver (mint) an asset to the specified recipient
     * @dev This function is called by the marketplace/auction house during settlement of a lazy listing.
     *      Implementations MUST restrict access to authorized marketplace contracts only.
     *
     * @param listingId The marketplace listing ID associated with this delivery
     * @param to The address to deliver (mint) the asset to
     * @param assetId The asset/token ID to deliver
     * @param payableCount The number of assets to deliver (1 for ERC721, can be >1 for ERC1155)
     * @param payableAmount The amount in wei (or ERC20 tokens) the seller receives for this delivery
     * @param payableERC20 The ERC20 token address for payment (address(0) for ETH)
     * @param index Optional index value for certain sales methods
     *
     * Requirements:
     * - Caller must be an authorized marketplace/auction house address
     * - Token with assetId must not already exist (for ERC721) or must have supply available (for ERC1155)
     * - Token metadata must be available at the expected URI
     */
    function deliver(
        uint40 listingId,
        address to,
        uint256 assetId,
        uint24 payableCount,
        uint256 payableAmount,
        address payableERC20,
        uint256 index
    ) external;
}
