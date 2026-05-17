// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IERC6551Registry.sol";
/**
 * @title SuchGallery
 * @notice ERC-721 collection where each NFT is a gallery (ERC-6551 token bound account).
 *         Owners deposit NFTs into their gallery and can transfer the entire gallery
 *         as a single asset. Season 1: 30 galleries, one per day via Dutch auction.
 *
 * Gallery NFTs get a 6551 token bound account automatically via the ERC6551Registry.
 */
contract SuchGallery is ERC721, ERC721Enumerable, ERC721Royalty, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ─── Constants ───────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 30;
    uint256 public constant SEASON = 1;
    uint256 public constant AUCTION_DURATION = 24 hours;

    // ─── Auction State ───────────────────────────────────────────
    uint256 public startPrice = 0.1 ether;
    uint256 public reservePrice = 0.01 ether;
    uint256 public priceDecayRate = 0.003 ether; // decay per hour
    uint256 public auctionStartTime;

    // ─── 6551 Registry ───────────────────────────────────────────
    IERC6551Registry public immutable tokenBoundRegistry;
    address public immutable tokenBoundImpl;

    event TokenBoundAccountCreated(uint256 indexed tokenId, address account);

    // ─── Deposited Art ─────────────────────────────────────────

    // galleryTokenId => deposited collections (for enumeration)
    mapping(uint256 => address[]) public depositedCollections;
    mapping(uint256 => mapping(address => bool)) public isDepositedCollection;

    // ─── Parametric Traits ──────────────────────────────────────
    struct GalleryTraits {
        uint8 wallHue;
        uint8 floorMaterial;  // 0=concrete, 1=wood, 2=marble, 3=polished
        uint8 lighting;       // 0=warm, 1=cool, 2=neutral, 3=dramatic
        uint8 trimStyle;      // 0=none, 1=minimal, 2=ornate, 3=industrial
    }

    mapping(uint256 => GalleryTraits) public traits;

    // ─── Events ──────────────────────────────────────────────────
    event GalleryMinted(uint256 indexed tokenId, address indexed owner, uint256 price);
    event ArtDeposited(uint256 indexed galleryTokenId, address indexed collection, uint256 indexed tokenId);
    event ArtWithdrawn(uint256 indexed galleryTokenId, address indexed collection, uint256 indexed tokenId);
    event AuctionConfigured(uint256 startPrice, uint256 reservePrice, uint256 decayRate);

    // ─── Constructor ─────────────────────────────────────────────
    constructor(
        address _registry,
        address _implementation
    ) ERC721("such.gallery", "SUCHGAL") Ownable(msg.sender) {
        tokenBoundRegistry = IERC6551Registry(_registry);
        tokenBoundImpl = _implementation;
        _setDefaultRoyalty(msg.sender, 1000); // 10%
    }

    // ─── Auction ─────────────────────────────────────────────────

    /**
     * @notice Start the daily auction. Called by owner once per day.
     *         Tokens mint sequentially: 1, 2, 3... up to MAX_SUPPLY.
     */
    function startAuction() external onlyOwner {
        require(auctionStartTime == 0 || block.timestamp >= auctionStartTime + AUCTION_DURATION,
            "Previous auction still active");
        require(totalSupply() < MAX_SUPPLY, "Season complete");

        if (auctionStartTime == 0) {
            auctionStartTime = block.timestamp;
        } else {
            // Ensure next auction starts at least 24h after previous
            auctionStartTime = auctionStartTime + AUCTION_DURATION;
        }
    }

    /**
     * @notice Current mint price based on Dutch auction decay.
     */
    function getCurrentPrice() public view returns (uint256) {
        if (auctionStartTime == 0 || block.timestamp < auctionStartTime) return startPrice;

        uint256 elapsed = block.timestamp - auctionStartTime;
        if (elapsed >= AUCTION_DURATION) return reservePrice;

        uint256 decay = (elapsed / 1 hours) * priceDecayRate;
        uint256 price = startPrice > decay ? startPrice - decay : reservePrice;
        return price > reservePrice ? price : reservePrice;
    }

    /**
     * @notice Mint the next gallery NFT at current Dutch auction price.
     */
    function mint() external payable nonReentrant {
        require(auctionStartTime > 0, "Auction not started");
        require(block.timestamp >= auctionStartTime, "Auction not started yet");
        require(block.timestamp < auctionStartTime + AUCTION_DURATION, "Auction ended");
        require(totalSupply() < MAX_SUPPLY, "Season complete");

        uint256 price = getCurrentPrice();
        require(msg.value >= price, "Insufficient payment");

        uint256 tokenId = totalSupply() + 1;

        // Generate parametric traits from tokenId seed
        traits[tokenId] = _generateTraits(tokenId);

        _safeMint(msg.sender, tokenId);

        // Create ERC-6551 token bound account for this gallery
        address tba = tokenBoundRegistry.createAccount(
            tokenBoundImpl,
            bytes32(0),         // salt = 0 for default single TBA per token
            block.chainid,
            address(this),
            tokenId
        );
        emit TokenBoundAccountCreated(tokenId, tba);

        // Refund excess
        if (msg.value > price) {
            (bool refunded, ) = msg.sender.call{value: msg.value - price}("");
            require(refunded, "Refund failed");
        }

        emit GalleryMinted(tokenId, msg.sender, price);
    }

    // ─── Trait Generation ────────────────────────────────────────

    function _generateTraits(uint256 tokenId) internal pure returns (GalleryTraits memory) {
        // Simple deterministic generation from tokenId
        uint256 seed = tokenId;
        return GalleryTraits({
            wallHue: uint8((seed * 37) % 360),
            floorMaterial: uint8((seed * 13) % 4),
            lighting: uint8((seed * 7) % 4),
            trimStyle: uint8((seed * 23) % 4)
        });
    }

    // ─── Art Deposit & Withdrawal ───────────────────────────────

    /**
     * @notice Record that an NFT was deposited into the gallery's 6551 account.
     *         Called after transferring the NFT to the token bound account.
     */
    function registerDeposit(
        uint256 galleryTokenId,
        address collection,
        uint256 artTokenId
    ) external {
        require(ownerOf(galleryTokenId) == msg.sender, "Not gallery owner");

        if (!isDepositedCollection[galleryTokenId][collection]) {
            depositedCollections[galleryTokenId].push(collection);
            isDepositedCollection[galleryTokenId][collection] = true;
        }

        emit ArtDeposited(galleryTokenId, collection, artTokenId);
    }

    /**
     * @notice Record that an NFT was withdrawn from the gallery's 6551 account.
     *         Called after transferring the NFT out of the token bound account.
     *         Note: does not remove from depositedCollections array (gas inefficient),
     *         but clears the isDepositedCollection flag.
     */
    function registerWithdrawal(
        uint256 galleryTokenId,
        address collection,
        uint256 artTokenId
    ) external {
        require(ownerOf(galleryTokenId) == msg.sender, "Not gallery owner");
        require(isDepositedCollection[galleryTokenId][collection], "Not deposited");

        isDepositedCollection[galleryTokenId][collection] = false;

        emit ArtWithdrawn(galleryTokenId, collection, artTokenId);
    }

    /**
     * @notice Get all deposited collections for a gallery.
     */
    function getDepositedCollections(uint256 galleryTokenId) external view returns (address[] memory) {
        return depositedCollections[galleryTokenId];
    }

    /**
     * @notice Get the 6551 token bound account address for a gallery NFT.
     *         Uses the registry's `account()` view — works even if the
     *         account hasn't been created yet (counterfactual address).
     */
    function getTokenBoundAccount(uint256 tokenId) public view returns (address) {
        return tokenBoundRegistry.account(
            tokenBoundImpl,
            bytes32(0),
            block.chainid,
            address(this),
            tokenId
        );
    }

    // ─── Admin ───────────────────────────────────────────────────

    function configureAuction(
        uint256 _startPrice,
        uint256 _reservePrice,
        uint256 _decayRate
    ) external onlyOwner {
        startPrice = _startPrice;
        reservePrice = _reservePrice;
        priceDecayRate = _decayRate;
        emit AuctionConfigured(_startPrice, _reservePrice, _decayRate);
    }

    function withdraw() external onlyOwner {
        (bool sent, ) = owner().call{value: address(this).balance}("");
        require(sent, "Withdraw failed");
    }

    // ─── Token URI ───────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override(ERC721) returns (string memory) {
        _requireOwned(tokenId);

        GalleryTraits memory t = traits[tokenId];
        // For now return on-chain JSON. Later: IPFS with rendered gallery image.
        return string(abi.encodePacked(
            "data:application/json;base64,",
            _encode(
                abi.encodePacked(
                    '{"name":"such.gallery #', tokenId.toString(),
                    '","description":"A living gallery. Deposit art, curate your space, transfer the collection as one.","image":"https://such.gallery/api/preview/',
                    tokenId.toString(),
                    '","attributes":[{"trait_type":"Season","value":', Strings.toString(SEASON),
                    '},{"trait_type":"Wall Hue","value":', Strings.toString(t.wallHue),
                    '},{"trait_type":"Floor Material","value":', Strings.toString(t.floorMaterial),
                    '},{"trait_type":"Lighting","value":', Strings.toString(t.lighting),
                    '},{"trait_type":"Trim Style","value":', Strings.toString(t.trimStyle),
                    '}]}'
                )
            )
        ));
    }

    function _encode(bytes memory data) internal pure returns (string memory) {
        bytes memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 len = data.length;
        if (len == 0) return "";

        uint256 encodedLen = 4 * ((len + 2) / 3);
        bytes memory result = new bytes(encodedLen);

        uint256 i = 0;
        uint256 j = 0;
        for (; i + 3 <= len; i += 3) {
            uint24 chunk = uint24(uint8(data[i])) << 16 | uint24(uint8(data[i + 1])) << 8 | uint24(uint8(data[i + 2]));
            result[j++] = table[chunk >> 18];
            result[j++] = table[(chunk >> 12) & 0x3F];
            result[j++] = table[(chunk >> 6) & 0x3F];
            result[j++] = table[chunk & 0x3F];
        }
        if (len % 3 == 1) {
            uint24 chunk = uint24(uint8(data[i])) << 16;
            result[j++] = table[chunk >> 18];
            result[j++] = table[(chunk >> 12) & 0x3F];
            result[j++] = bytes1("=");
            result[j++] = bytes1("=");
        } else if (len % 3 == 2) {
            uint24 chunk = uint24(uint8(data[i])) << 16 | uint24(uint8(data[i + 1])) << 8;
            result[j++] = table[chunk >> 18];
            result[j++] = table[(chunk >> 12) & 0x3F];
            result[j++] = table[(chunk >> 6) & 0x3F];
            result[j++] = bytes1("=");
        }
        return string(result);
    }

    // ─── Overrides ───────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
