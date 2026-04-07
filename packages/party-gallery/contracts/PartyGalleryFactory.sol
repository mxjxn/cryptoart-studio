// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {GalleryNFT} from "./GalleryNFT.sol";
import {IERC6551Registry} from "./interfaces/IERC6551Registry.sol";

/**
 * @title PartyGalleryFactory
 * @notice Factory for creating Party-owned galleries
 * @dev Simplifies the process of creating a gallery for a Party DAO
 *
 * Usage flow:
 *   1. Party is created via Party Protocol
 *   2. Call createPartyGallery(partyAddress, name, description, url)
 *   3. Factory creates GalleryNFT owned by the Party
 *   4. Factory ensures 6551 account is deployed
 *   5. Party can now govern the gallery via proposals
 */
contract PartyGalleryFactory {
    // =============================================================
    //                           ERRORS
    // =============================================================

    error ZeroAddress();
    error NotPartyContract();

    // =============================================================
    //                           EVENTS
    // =============================================================

    event PartyGalleryCreated(
        address indexed party,
        uint256 indexed galleryTokenId,
        address indexed galleryAccount,
        string name
    );

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice The GalleryNFT contract
    GalleryNFT public immutable galleryNFT;

    /// @notice ERC-6551 registry
    IERC6551Registry public immutable registry;

    /// @notice Account implementation
    address public immutable accountImplementation;

    /// @notice Mapping of party address to their gallery token IDs
    mapping(address => uint256[]) public partyGalleries;

    /// @notice Mapping of gallery token ID to the party that owns it
    mapping(uint256 => address) public galleryToParty;

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(
        address _galleryNFT,
        address _registry,
        address _accountImplementation
    ) {
        if (_galleryNFT == address(0) || _registry == address(0) || _accountImplementation == address(0)) {
            revert ZeroAddress();
        }

        galleryNFT = GalleryNFT(_galleryNFT);
        registry = IERC6551Registry(_registry);
        accountImplementation = _accountImplementation;
    }

    // =============================================================
    //                      FACTORY FUNCTIONS
    // =============================================================

    /**
     * @notice Create a gallery owned by a Party DAO
     * @param party The Party contract address that will own the gallery
     * @param name Gallery name
     * @param description Gallery description
     * @param externalUrl External URL for the gallery
     * @return galleryTokenId The gallery's NFT token ID
     * @return galleryAccount The gallery's 6551 account address
     */
    function createPartyGallery(
        address party,
        string calldata name,
        string calldata description,
        string calldata externalUrl
    ) external returns (uint256 galleryTokenId, address galleryAccount) {
        if (party == address(0)) revert ZeroAddress();

        // Optional: Verify it's actually a Party contract
        // This could check for specific interface support
        // For now, we trust the caller

        // Create the gallery owned by the Party
        (galleryTokenId, galleryAccount) = galleryNFT.createGalleryFor(
            party,
            name,
            description,
            externalUrl
        );

        // Track the relationship
        partyGalleries[party].push(galleryTokenId);
        galleryToParty[galleryTokenId] = party;

        emit PartyGalleryCreated(party, galleryTokenId, galleryAccount, name);
    }

    /**
     * @notice Get all galleries owned by a party
     * @param party The party address
     * @return Array of gallery token IDs
     */
    function getPartyGalleries(address party) external view returns (uint256[] memory) {
        return partyGalleries[party];
    }

    /**
     * @notice Get the number of galleries owned by a party
     * @param party The party address
     * @return The count of galleries
     */
    function getPartyGalleryCount(address party) external view returns (uint256) {
        return partyGalleries[party].length;
    }

    /**
     * @notice Compute the gallery account address without creating it
     * @param galleryTokenId The gallery token ID
     * @return The computed account address
     */
    function computeGalleryAccount(uint256 galleryTokenId) external view returns (address) {
        return registry.account(
            accountImplementation,
            bytes32(0),
            block.chainid,
            address(galleryNFT),
            galleryTokenId
        );
    }
}
