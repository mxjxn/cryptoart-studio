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
        uint256 totalRedemptionCap;   // Max total redemptions (0 = unlimited)
        uint256 perWalletCap;         // Max redemptions per wallet (0 = unlimited)
        uint48 startTime;             // Unix timestamp when redemptions can start (0 = immediate)
        uint48 endTime;               // Unix timestamp when redemptions end (0 = never)
        string targetBaseURI;         // For ERC721 targets, base URI for minted tokens
    }

    // Dead address for tokens that can't be burned
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Config ID => BurnConfig
    mapping(uint256 => BurnConfig) public burnConfigs;
    uint256 public configCount;

    // Track burns per user per config
    mapping(uint256 => mapping(address => uint256)) public userBurns;
    
    // Track total mints per config (for redemption cap)
    mapping(uint256 => uint256) public totalMinted;

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
     * @param targetCollection The SuchCollection to mint in (must be owned by extension owner)
     * @param targetSpec ERC721 or ERC1155
     * @param targetTokenId For ERC1155 targets, which token ID to mint
     * @param burnRatio How many source tokens needed per mint set (numerator)
     * @param mintRatio How many target tokens to mint per burn set (denominator)
     * @param requiresBurn True if source implements burn(), false to transfer to dead address
     * @param totalRedemptionCap Max total redemptions (0 = unlimited)
     * @param perWalletCap Max redemptions per wallet (0 = unlimited)
     * @param startTime Unix timestamp when redemptions start (0 = immediate)
     * @param endTime Unix timestamp when redemptions end (0 = never)
     * @param targetBaseURI For ERC721 targets, base URI ending with '/' for minted tokens.
     *                      Tokens are numbered 0-based within the config: `targetBaseURI + "0"`, `"1"`, ...
     */
    function createBurnConfig(
        address sourceContract,
        TokenSpec sourceSpec,
        address targetCollection,
        TokenSpec targetSpec,
        uint256 targetTokenId,
        uint256 burnRatio,
        uint256 mintRatio,
        bool requiresBurn,
        uint256 totalRedemptionCap,
        uint256 perWalletCap,
        uint48 startTime,
        uint48 endTime,
        string calldata targetBaseURI
    ) external onlyOwner returns (uint256 configId) {
        require(sourceContract != address(0), "Invalid source");
        require(targetCollection != address(0), "Invalid target");
        require(burnRatio > 0, "Burn ratio must be > 0");
        require(mintRatio > 0, "Mint ratio must be > 0");
        
        // Verify that the extension owner owns the target collection
        // This prevents unauthorized users from creating burn configs for collections they don't own
        require(Ownable(targetCollection).owner() == owner(), "Extension owner must own target collection");
        
        // If target is ERC1155, token ID is required
        if (targetSpec == TokenSpec.ERC1155) {
            require(targetTokenId > 0, "Target token ID required for ERC1155");
        } else {
            // For ERC721, require base URI ending with '/'
            bytes memory baseURIBytes = bytes(targetBaseURI);
            require(baseURIBytes.length > 0, "Target base URI required for ERC721");
            require(baseURIBytes[baseURIBytes.length - 1] == "/", "Base URI must end with /");
        }
        
        // Time window validation
        if (startTime > 0 && endTime > 0) {
            require(endTime > startTime, "End time must be after start time");
        }
        
        // Verify source contract supports expected interface (protection against fake contracts)
        if (sourceSpec == TokenSpec.ERC721) {
            require(
                IERC165(sourceContract).supportsInterface(type(IERC721).interfaceId),
                "Source must support ERC721"
            );
        } else {
            require(
                IERC165(sourceContract).supportsInterface(type(IERC1155).interfaceId),
                "Source must support ERC1155"
            );
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
            isActive: true,
            totalRedemptionCap: totalRedemptionCap,
            perWalletCap: perWalletCap,
            startTime: startTime,
            endTime: endTime,
            targetBaseURI: targetBaseURI
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
     */
    function burnToMint(
        uint256 configId,
        uint256[] calldata sourceTokenIds,  // For ERC721 source
        uint256 sourceTokenId,              // For ERC1155 source
        uint256 sourceAmount                // For ERC1155 source
    ) external nonReentrant returns (uint256[] memory mintedTokenIds) {
        require(configId < configCount, "Invalid config");
        BurnConfig memory config = burnConfigs[configId];
        require(config.isActive, "Config not active");
        
        // Check time windows
        if (config.startTime > 0) {
            require(block.timestamp >= config.startTime, "Redemption not started");
        }
        if (config.endTime > 0) {
            require(block.timestamp <= config.endTime, "Redemption ended");
        }

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

        // Calculate how many to mint - must be exact multiple to prevent loss of burned tokens
        require(burnedCount % config.burnRatio == 0, "Must burn exact multiple of ratio");
        uint256 sets = burnedCount / config.burnRatio;
        uint256 mintAmount = sets * config.mintRatio;
        
        // Check per-wallet cap (before external calls - CEI pattern)
        if (config.perWalletCap > 0) {
            require(
                userBurns[configId][msg.sender] + mintAmount <= config.perWalletCap,
                "Exceeds per-wallet cap"
            );
        }
        
        // Check total redemption cap (before external calls - CEI pattern)
        if (config.totalRedemptionCap > 0) {
            require(
                totalMinted[configId] + mintAmount <= config.totalRedemptionCap,
                "Exceeds total redemption cap"
            );
        }

        // Update state before external calls (CEI pattern)
        userBurns[configId][msg.sender] += mintAmount;
        totalMinted[configId] += mintAmount;

        // Mint target tokens - URIs come from config, not user input
        if (config.targetSpec == TokenSpec.ERC721) {
            mintedTokenIds = _mintERC721(config, mintAmount, configId);
        } else {
            mintedTokenIds = new uint256[](1);
            mintedTokenIds[0] = config.targetTokenId;
            _mintERC1155(config, mintAmount);
        }

        emit BurnedToMint(configId, msg.sender, burnedCount, mintAmount, mintedTokenIds);
    }

    function _burnERC721(BurnConfig memory config, uint256[] calldata tokenIds) internal {
        IERC721 source = IERC721(config.sourceContract);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Verify ownership BEFORE any state changes (guard against fake contracts)
            address originalOwner = source.ownerOf(tokenIds[i]);
            require(originalOwner == msg.sender, "Not token owner");
            
            // First transfer to this contract so we can burn/dispose
            source.transferFrom(msg.sender, address(this), tokenIds[i]);
            
            // Verify transfer actually happened (guard against malicious contracts)
            require(source.ownerOf(tokenIds[i]) == address(this), "Transfer failed");
            
            if (config.requiresBurn) {
                // Try to call burn function from this contract
                (bool success,) = config.sourceContract.call(
                    abi.encodeWithSignature("burn(uint256)", tokenIds[i])
                );
                require(success, "Burn failed");
                
                // Verify burn actually happened (token should not exist or be owned by zero address)
                // Note: Not all contracts revert on ownerOf for burned tokens, some return address(0)
                try source.ownerOf(tokenIds[i]) returns (address currentOwner) {
                    require(currentOwner == address(0), "Burn verification failed");
                } catch {
                    // Expected for properly burned tokens that revert on ownerOf
                }
            } else {
                // Transfer to dead address
                source.transferFrom(address(this), DEAD_ADDRESS, tokenIds[i]);
                
                // Verify transfer to dead address succeeded
                require(source.ownerOf(tokenIds[i]) == DEAD_ADDRESS, "Dead address transfer failed");
            }
        }
    }

    function _burnERC1155(BurnConfig memory config, uint256 tokenId, uint256 amount) internal {
        IERC1155 source = IERC1155(config.sourceContract);
        
        // Verify balance BEFORE any state changes (guard against fake contracts)
        uint256 balanceBefore = source.balanceOf(msg.sender, tokenId);
        require(balanceBefore >= amount, "Insufficient balance");
        
        if (config.requiresBurn) {
            // Try to call burn function
            (bool success,) = config.sourceContract.call(
                abi.encodeWithSignature("burn(address,uint256,uint256)", msg.sender, tokenId, amount)
            );
            require(success, "Burn failed");
            
            // Verify burn actually reduced balance (guard against malicious contracts)
            uint256 balanceAfter = source.balanceOf(msg.sender, tokenId);
            require(balanceAfter == balanceBefore - amount, "Burn verification failed");
        } else {
            // Transfer to dead address
            uint256 deadBalanceBefore = source.balanceOf(DEAD_ADDRESS, tokenId);
            source.safeTransferFrom(msg.sender, DEAD_ADDRESS, tokenId, amount, "");
            
            // Verify transfer actually happened (guard against malicious contracts)
            uint256 balanceAfter = source.balanceOf(msg.sender, tokenId);
            uint256 deadBalanceAfter = source.balanceOf(DEAD_ADDRESS, tokenId);
            require(balanceAfter == balanceBefore - amount, "Transfer failed: sender balance");
            require(deadBalanceAfter == deadBalanceBefore + amount, "Transfer failed: dead address balance");
        }
    }

    function _mintERC721(BurnConfig memory config, uint256 amount, uint256 configId)
        internal
        returns (uint256[] memory tokenIds)
    {
        ISuchCollection target = ISuchCollection(config.targetCollection);
        tokenIds = new uint256[](amount);
        
        // Generate URIs from base URI + mint count for this config
        uint256 startCount = totalMinted[configId] - amount; // Already incremented above
        
        for (uint256 i = 0; i < amount; i++) {
            // URI = baseURI + (startCount + i)
            string memory uri = string(abi.encodePacked(config.targetBaseURI, _toString(startCount + i)));
            tokenIds[i] = target.mintExtension(msg.sender, uri);
        }
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
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
