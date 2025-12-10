// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IMarketplace} from "./interfaces/IMarketplace.sol";
import {IERC6551Account, IERC6551Executable} from "./interfaces/IERC6551Account.sol";

/**
 * @title GalleryActions
 * @notice Helper library for building gallery action calldata
 * @dev Used to construct proposal data for Party governance
 *
 * Typical flow:
 *   1. Party member calls GalleryActions.buildBidAction(...)
 *   2. Returns calldata for GalleryAccount.execute(...)
 *   3. Member creates Party proposal with this calldata
 *   4. Other members vote
 *   5. If passed, Party executes -> GalleryAccount.execute -> Marketplace.bid
 */
library GalleryActions {
    // =============================================================
    //                      BIDDING ACTIONS
    // =============================================================

    /**
     * @notice Build calldata to bid on an auction
     * @param marketplace The marketplace contract address
     * @param listingId The listing to bid on
     * @param bidAmount The amount to bid (in wei or token units)
     * @param referrer Optional referrer address
     * @return target The target address (gallery account)
     * @return value The ETH value to send
     * @return data The calldata to execute
     */
    function buildBidAction(
        address marketplace,
        uint40 listingId,
        uint256 bidAmount,
        address referrer
    ) internal pure returns (address target, uint256 value, bytes memory data) {
        target = marketplace;
        value = bidAmount;

        if (referrer != address(0)) {
            // bid(address referrer, uint40 listingId, uint256 bidAmount, bool increase)
            data = abi.encodeWithSelector(
                IMarketplace.bid.selector,
                referrer,
                listingId,
                bidAmount,
                false // exact bid amount, not increase
            );
        } else {
            // bid(uint40 listingId, bool increase)
            data = abi.encodeWithSelector(
                bytes4(keccak256("bid(uint40,bool)")),
                listingId,
                false
            );
        }
    }

    /**
     * @notice Build full execute calldata for bidding through a gallery account
     * @param galleryAccount The gallery's 6551 account
     * @param marketplace The marketplace contract
     * @param listingId The listing to bid on
     * @param bidAmount The bid amount
     * @param referrer Optional referrer
     * @return executeData Calldata to call on the gallery account
     */
    function encodeBidExecution(
        address galleryAccount,
        address marketplace,
        uint40 listingId,
        uint256 bidAmount,
        address referrer
    ) internal pure returns (bytes memory executeData) {
        (address target, uint256 value, bytes memory data) = buildBidAction(
            marketplace,
            listingId,
            bidAmount,
            referrer
        );

        executeData = abi.encodeWithSelector(
            IERC6551Account.execute.selector,
            target,
            value,
            data
        );
    }

    // =============================================================
    //                      PURCHASE ACTIONS
    // =============================================================

    /**
     * @notice Build calldata to purchase a fixed-price listing
     * @param marketplace The marketplace contract address
     * @param listingId The listing to purchase
     * @param purchaseAmount The purchase price
     * @param referrer Optional referrer address
     * @return target The target address
     * @return value The ETH value to send
     * @return data The calldata to execute
     */
    function buildPurchaseAction(
        address marketplace,
        uint40 listingId,
        uint256 purchaseAmount,
        address referrer
    ) internal pure returns (address target, uint256 value, bytes memory data) {
        target = marketplace;
        value = purchaseAmount;

        if (referrer != address(0)) {
            data = abi.encodeWithSelector(
                IMarketplace.purchase.selector,
                referrer,
                listingId
            );
        } else {
            data = abi.encodeWithSelector(
                bytes4(keccak256("purchase(uint40)")),
                listingId
            );
        }
    }

    /**
     * @notice Build full execute calldata for purchasing through a gallery account
     */
    function encodePurchaseExecution(
        address galleryAccount,
        address marketplace,
        uint40 listingId,
        uint256 purchaseAmount,
        address referrer
    ) internal pure returns (bytes memory executeData) {
        (address target, uint256 value, bytes memory data) = buildPurchaseAction(
            marketplace,
            listingId,
            purchaseAmount,
            referrer
        );

        executeData = abi.encodeWithSelector(
            IERC6551Account.execute.selector,
            target,
            value,
            data
        );
    }

    // =============================================================
    //                      LISTING ACTIONS
    // =============================================================

    /**
     * @notice Build calldata to create a new listing for an NFT held by the gallery
     * @param marketplace The marketplace contract address
     * @param tokenAddress The NFT contract address
     * @param tokenId The NFT token ID
     * @param tokenSpec ERC721 or ERC1155
     * @param amount Amount for ERC1155 (1 for ERC721)
     * @param listingType Type of listing
     * @param initialAmount Starting price
     * @param erc20 Payment token (address(0) for ETH)
     * @param startTime Listing start time
     * @param endTime Listing end time
     * @return operations Array of operations (approve + createListing)
     */
    function buildCreateListingAction(
        address marketplace,
        address tokenAddress,
        uint256 tokenId,
        IMarketplace.TokenSpec tokenSpec,
        uint256 amount,
        IMarketplace.ListingType listingType,
        uint256 initialAmount,
        address erc20,
        uint40 startTime,
        uint40 endTime
    ) internal pure returns (IERC6551Executable.Operation[] memory operations) {
        operations = new IERC6551Executable.Operation[](2);

        // First: Approve the marketplace to transfer the NFT
        operations[0] = IERC6551Executable.Operation({
            to: tokenAddress,
            value: 0,
            data: abi.encodeWithSelector(
                bytes4(keccak256("approve(address,uint256)")),
                marketplace,
                tokenId
            )
        });

        // Second: Create the listing
        operations[1] = IERC6551Executable.Operation({
            to: marketplace,
            value: 0,
            data: abi.encodeWithSelector(
                IMarketplace.createListing.selector,
                tokenAddress,
                tokenId,
                tokenSpec,
                amount,
                listingType,
                initialAmount,
                erc20,
                startTime,
                endTime
            )
        });
    }

    /**
     * @notice Encode batch execution for creating a listing
     */
    function encodeCreateListingExecution(
        address marketplace,
        address tokenAddress,
        uint256 tokenId,
        IMarketplace.TokenSpec tokenSpec,
        uint256 amount,
        IMarketplace.ListingType listingType,
        uint256 initialAmount,
        address erc20,
        uint40 startTime,
        uint40 endTime
    ) internal pure returns (bytes memory executeData) {
        IERC6551Executable.Operation[] memory operations = buildCreateListingAction(
            marketplace,
            tokenAddress,
            tokenId,
            tokenSpec,
            amount,
            listingType,
            initialAmount,
            erc20,
            startTime,
            endTime
        );

        executeData = abi.encodeWithSelector(
            IERC6551Executable.executeBatch.selector,
            operations
        );
    }

    // =============================================================
    //                      OFFER ACTIONS
    // =============================================================

    /**
     * @notice Build calldata to create an offer on a listing
     */
    function buildCreateOfferAction(
        address marketplace,
        uint40 listingId,
        uint256 offerAmount,
        address erc20,
        uint40 expirationTime
    ) internal pure returns (address target, uint256 value, bytes memory data) {
        target = marketplace;
        value = erc20 == address(0) ? offerAmount : 0;

        data = abi.encodeWithSelector(
            IMarketplace.createOffer.selector,
            listingId,
            offerAmount,
            erc20,
            expirationTime
        );
    }

    /**
     * @notice Build calldata to accept an offer on a listing owned by the gallery
     */
    function buildAcceptOfferAction(
        address marketplace,
        uint40 listingId,
        uint256 offerId
    ) internal pure returns (address target, uint256 value, bytes memory data) {
        target = marketplace;
        value = 0;

        data = abi.encodeWithSelector(
            IMarketplace.acceptOffer.selector,
            listingId,
            offerId
        );
    }

    // =============================================================
    //                      TRANSFER ACTIONS
    // =============================================================

    /**
     * @notice Build calldata to transfer an NFT out of the gallery
     * @param tokenAddress The NFT contract
     * @param tokenId The token ID
     * @param recipient The recipient address
     * @param isERC1155 Whether it's an ERC1155 token
     * @param amount Amount for ERC1155
     */
    function buildTransferNFTAction(
        address tokenAddress,
        uint256 tokenId,
        address recipient,
        bool isERC1155,
        uint256 amount
    ) internal pure returns (address target, uint256 value, bytes memory data) {
        target = tokenAddress;
        value = 0;

        if (isERC1155) {
            data = abi.encodeWithSelector(
                bytes4(keccak256("safeTransferFrom(address,address,uint256,uint256,bytes)")),
                address(0), // Will be replaced with gallery account address
                recipient,
                tokenId,
                amount,
                ""
            );
        } else {
            data = abi.encodeWithSelector(
                bytes4(keccak256("safeTransferFrom(address,address,uint256)")),
                address(0), // Will be replaced with gallery account address
                recipient,
                tokenId
            );
        }
    }

    /**
     * @notice Build calldata to transfer ETH out of the gallery
     */
    function buildTransferETHAction(
        address recipient,
        uint256 amount
    ) internal pure returns (address target, uint256 value, bytes memory data) {
        target = recipient;
        value = amount;
        data = "";
    }

    /**
     * @notice Build calldata to transfer ERC20 tokens out of the gallery
     */
    function buildTransferERC20Action(
        address token,
        address recipient,
        uint256 amount
    ) internal pure returns (address target, uint256 value, bytes memory data) {
        target = token;
        value = 0;
        data = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            amount
        );
    }
}
