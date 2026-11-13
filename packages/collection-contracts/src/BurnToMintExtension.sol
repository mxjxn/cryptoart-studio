// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {Ownable} from "openzeppelin/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin/utils/ReentrancyGuard.sol";
import {IERC721} from "openzeppelin/token/ERC721/IERC721.sol";
import {IERC1155} from "openzeppelin/token/ERC1155/IERC1155.sol";
import {IERC165} from "openzeppelin/utils/introspection/IERC165.sol";

interface ISuchCollection {
    function mintExtension(address to, string calldata uri) external returns (uint256);
}

interface ISuchCollection1155 {
    function mintExisting(address to, uint256 tokenId, uint256 amount) external;
}

/**
 * @title BurnToMintExtension
 * @notice Extension that allows burning tokens from a source contract to mint tokens in a target collection
 * @dev Supports both ERC721 and ERC1155 source contracts, including external contracts.
 *      Uses safe checks for contracts that don't implement burn functions.
 */
contract BurnToMintExtension is Ownable, ReentrancyGuard {
    // Token spec enum
    enum TokenSpec {
        ERC721,
        ERC1155
    }

    // Burn-to-mint configuration
    struct BurnConfig {
        address sourceContract;      // Contract to burn from
        TokenSpec sourceSpec;         // ERC721 or ERC1155
        address targetCollection;     // SuchCollection to mint in
        TokenSpec targetSpec;         // ERC721 or ERC1155
        uint256 targetTokenId;        // For ERC1155 targets, which token ID to mint
        uint256 burnRatio;            // How many source tokens = 1 target token (e.g., 2:1)
        uint256 mintRatio;            // How many target tokens per burn set (e.g., 1:1)
        bool requiresBurn;            // True if source has burn(), false to transfer to dead address
        bool isActive;                // Can be paused by owner
    }

    // Dead address for tokens that can't be burned
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Config ID => BurnConfig
    mapping(uint256 => BurnConfig) public burnConfigs;
    uint256 public configCount;

    // Track burns per user per config (to prevent abuse)
    mapping(uint256 => mapping(address => uint256)) public userBurns;

    event BurnConfigCreated(
        uint256 indexed configId,
        address indexed sourceContract,
        address indexed targetCollection,
        TokenSpec sourceSpec,
        TokenSpec targetSpec
    );
    event BurnConfigUpdated(uint256 indexed configId, bool isActive);
    event BurnedToMint(
        uint256 indexed configId,
        address indexed user,
        uint256 burnedAmount,
        uint256 mintedAmount,
        uint256[] mintedTokenIds
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Create a new burn-to-mint configuration
     * @param sourceContract The contract to burn tokens from (can be external)
     * @param sourceSpec ERC721 or ERC1155
     * @param targetCollection The SuchCollection to mint in (must be registered as extension)
     * @param targetSpec ERC721 or ERC1155
     * @param targetTokenId For ERC1155 targets, which token ID to mint
     * @param burnRatio How many source tokens needed per mint set (numerator)
     * @param mintRatio How many target tokens to mint per burn set (denominator)
     * @param requiresBurn True if source implements burn(), false to transfer to dead address
     */
    function createBurnConfig(
        address sourceContract,
        TokenSpec sourceSpec,
        address targetCollection,
        TokenSpec targetSpec,
        uint256 targetTokenId,
        uint256 burnRatio,
        uint256 mintRatio,
        bool requiresBurn
    ) external onlyOwner returns (uint256 configId) {
        require(sourceContract != address(0), "Invalid source");
        require(targetCollection != address(0), "Invalid target");
        require(burnRatio > 0, "Burn ratio must be > 0");
        require(mintRatio > 0, "Mint ratio must be > 0");
        
        // If target is ERC1155, token ID is required
        if (targetSpec == TokenSpec.ERC1155) {
            require(targetTokenId > 0, "Target token ID required for ERC1155");
        }

        configId = configCount++;
        
        burnConfigs[configId] = BurnConfig({
            sourceContract: sourceContract,
            sourceSpec: sourceSpec,
            targetCollection: targetCollection,
            targetSpec: targetSpec,
            targetTokenId: targetTokenId,
            burnRatio: burnRatio,
            mintRatio: mintRatio,
            requiresBurn: requiresBurn,
            isActive: true
        });

        emit BurnConfigCreated(configId, sourceContract, targetCollection, sourceSpec, targetSpec);
    }

    /**
     * @notice Update a burn config's active status
     */
    function setBurnConfigActive(uint256 configId, bool isActive) external onlyOwner {
        require(configId < configCount, "Invalid config");
        burnConfigs[configId].isActive = isActive;
        emit BurnConfigUpdated(configId, isActive);
    }

    /**
     * @notice Burn tokens and mint from target collection
     * @param configId The burn configuration to use
     * @param sourceTokenIds For ERC721 source: array of token IDs to burn
     * @param sourceTokenId For ERC1155 source: the token ID to burn from
     * @param sourceAmount For ERC1155 source: how many to burn
     * @param targetURIs For ERC721 target: array of URIs for minted tokens
     */
    function burnToMint(
        uint256 configId,
        uint256[] calldata sourceTokenIds,  // For ERC721 source
        uint256 sourceTokenId,              // For ERC1155 source
        uint256 sourceAmount,               // For ERC1155 source
        string[] calldata targetURIs        // For ERC721 target
    ) external nonReentrant returns (uint256[] memory mintedTokenIds) {
        require(configId < configCount, "Invalid config");
        BurnConfig memory config = burnConfigs[configId];
        require(config.isActive, "Config not active");

        uint256 burnedCount;

        // Handle source burning/transfer
        if (config.sourceSpec == TokenSpec.ERC721) {
            burnedCount = sourceTokenIds.length;
            require(burnedCount > 0, "No tokens to burn");
            _burnERC721(config, sourceTokenIds);
        } else {
            require(sourceAmount > 0, "Amount must be > 0");
            burnedCount = sourceAmount;
            _burnERC1155(config, sourceTokenId, sourceAmount);
        }

        // Calculate how many to mint
        require(burnedCount >= config.burnRatio, "Insufficient burn amount");
        uint256 sets = burnedCount / config.burnRatio;
        uint256 mintAmount = sets * config.mintRatio;

        // Mint target tokens
        if (config.targetSpec == TokenSpec.ERC721) {
            require(targetURIs.length == mintAmount, "URI count mismatch");
            mintedTokenIds = _mintERC721(config, mintAmount, targetURIs);
        } else {
            mintedTokenIds = new uint256[](1);
            mintedTokenIds[0] = config.targetTokenId;
            _mintERC1155(config, mintAmount);
        }

        userBurns[configId][msg.sender] += burnedCount;

        emit BurnedToMint(configId, msg.sender, burnedCount, mintAmount, mintedTokenIds);
    }

    function _burnERC721(BurnConfig memory config, uint256[] calldata tokenIds) internal {
        IERC721 source = IERC721(config.sourceContract);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(source.ownerOf(tokenIds[i]) == msg.sender, "Not token owner");
            
            // First transfer to this contract so we can burn/dispose
            source.transferFrom(msg.sender, address(this), tokenIds[i]);
            
            if (config.requiresBurn) {
                // Try to call burn function from this contract
                (bool success,) = config.sourceContract.call(
                    abi.encodeWithSignature("burn(uint256)", tokenIds[i])
                );
                require(success, "Burn failed");
            } else {
                // Transfer to dead address
                source.transferFrom(address(this), DEAD_ADDRESS, tokenIds[i]);
            }
        }
    }

    function _burnERC1155(BurnConfig memory config, uint256 tokenId, uint256 amount) internal {
        IERC1155 source = IERC1155(config.sourceContract);
        require(source.balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        
        if (config.requiresBurn) {
            // Try to call burn function
            (bool success,) = config.sourceContract.call(
                abi.encodeWithSignature("burn(address,uint256,uint256)", msg.sender, tokenId, amount)
            );
            require(success, "Burn failed");
        } else {
            // Transfer to dead address
            source.safeTransferFrom(msg.sender, DEAD_ADDRESS, tokenId, amount, "");
        }
    }

    function _mintERC721(BurnConfig memory config, uint256 amount, string[] calldata uris)
        internal
        returns (uint256[] memory tokenIds)
    {
        ISuchCollection target = ISuchCollection(config.targetCollection);
        tokenIds = new uint256[](amount);
        
        for (uint256 i = 0; i < amount; i++) {
            tokenIds[i] = target.mintExtension(msg.sender, uris[i]);
        }
    }

    function _mintERC1155(BurnConfig memory config, uint256 amount) internal {
        ISuchCollection1155 target = ISuchCollection1155(config.targetCollection);
        target.mintExisting(msg.sender, config.targetTokenId, amount);
    }

    /**
     * @notice Get burn config details
     */
    function getBurnConfig(uint256 configId) external view returns (BurnConfig memory) {
        require(configId < configCount, "Invalid config");
        return burnConfigs[configId];
    }

    /**
     * @notice Check how many times a user has burned for a config
     */
    function getUserBurnCount(uint256 configId, address user) external view returns (uint256) {
        return userBurns[configId][user];
    }
}
