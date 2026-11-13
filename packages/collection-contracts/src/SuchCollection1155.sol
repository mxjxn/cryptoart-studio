// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {ERC1155} from "openzeppelin/token/ERC1155/ERC1155.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin/utils/ReentrancyGuard.sol";
import {IERC2981} from "openzeppelin/interfaces/IERC2981.sol";
import {IERC165} from "openzeppelin/utils/introspection/IERC165.sol";
import {ILazyDelivery} from "./interfaces/ILazyDelivery.sol";

/// @notice Multi-supply collection. Each token id has a supply that is limited (maxSupply > 0)
///         or open (maxSupply == 0). Not numbered editions.
contract SuchCollection1155 is ERC1155, Ownable, ReentrancyGuard, IERC2981, ILazyDelivery {
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event SupplyMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 maxSupply);
    event RoyaltyUpdated(address receiver, uint16 bps);
    event BaseURIUpdated(string baseURI);
    event MarketplaceApproved(address indexed marketplace, bool approved);
    event LazyDelivered(uint40 indexed listingId, address indexed to, uint256 indexed tokenId, uint256 amount);
    event Revealed(string revealedBaseURI, bytes32 metadataHash);

    string public name;
    string public symbol;

    uint256 private _tokenCount;

    mapping(uint256 => string) private _tokenURIs;
    /// @dev 0 = open (unlimited); >0 = hard cap on total minted for that id
    mapping(uint256 => uint256) public maxSupply;
    mapping(uint256 => uint256) public totalMinted;

    address payable private _royaltyReceiver;
    uint16 private _royaltyBPS;

    string private _baseURI;
    
    // Authorized marketplace/auction house addresses that can call deliver()
    mapping(address => bool) private _approvedMarketplaces;
    
    // Blind mint / reveal state
    bool private _isRevealed;
    string private _placeholderURI;
    bytes32 private _metadataCommitment;

    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        address payable royaltyReceiver_,
        uint16 royaltyBPS_
    ) ERC1155("") Ownable(owner_) {
        name = name_;
        symbol = symbol_;
        _royaltyReceiver = royaltyReceiver_;
        _royaltyBPS = royaltyBPS_;
    }

    /// @notice Distinct token ids created (not total units minted).
    function totalSupply() external view returns (uint256) {
        return _tokenCount;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        require(bytes(_tokenURIs[tokenId]).length != 0 || totalMinted[tokenId] > 0, "Unknown token");
        
        // If blind mint is configured and not revealed, return placeholder
        if (bytes(_placeholderURI).length > 0 && !_isRevealed) {
            return _placeholderURI;
        }
        
        if (bytes(_tokenURIs[tokenId]).length != 0) {
            return _tokenURIs[tokenId];
        }
        return string(abi.encodePacked(_baseURI, _toString(tokenId)));
    }

    /// @notice Create a new token id and mint `amount` to `to`.
    /// @param maxSupply_ 0 = open edition; >0 = limited supply cap
    function mint(
        address to,
        uint256 amount,
        uint256 maxSupply_,
        string calldata tokenURI_
    ) external onlyOwner nonReentrant returns (uint256 tokenId) {
        require(amount > 0, "Amount zero");
        require(bytes(tokenURI_).length > 0, "URI required");
        if (maxSupply_ > 0) {
            require(amount <= maxSupply_, "Exceeds max supply");
        }

        ++_tokenCount;
        tokenId = _tokenCount;
        maxSupply[tokenId] = maxSupply_;
        _tokenURIs[tokenId] = tokenURI_;
        totalMinted[tokenId] = amount;

        _mint(to, tokenId, amount, "");
        emit Minted(to, tokenId, tokenURI_);
        emit SupplyMinted(to, tokenId, amount, maxSupply_);
    }

    // Authorized minters (for extensions like burn-to-mint)
    mapping(address => bool) private _authorizedMinters;
    
    /// @notice Authorize an address to mint (e.g., burn-to-mint extension)
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        _authorizedMinters[minter] = authorized;
    }
    
    /// @notice Check if an address is authorized to mint
    function isAuthorizedMinter(address minter) external view returns (bool) {
        return _authorizedMinters[minter];
    }
    
    /// @notice Mint additional supply of an existing token id (open or under cap).
    /// @dev Can be called by owner or authorized minters
    function mintExisting(address to, uint256 tokenId, uint256 amount) external nonReentrant {
        require(msg.sender == owner() || _authorizedMinters[msg.sender], "Not authorized");
        require(amount > 0, "Amount zero");
        require(tokenId > 0 && tokenId <= _tokenCount, "Unknown token");
        uint256 cap = maxSupply[tokenId];
        if (cap > 0) {
            require(totalMinted[tokenId] + amount <= cap, "Exceeds max supply");
        }
        totalMinted[tokenId] += amount;
        _mint(to, tokenId, amount, "");
        emit SupplyMinted(to, tokenId, amount, cap);
        emit Minted(to, tokenId, _tokenURIs[tokenId]);
    }

    function setTokenURI(uint256 tokenId, string calldata tokenURI_) external onlyOwner {
        require(tokenId > 0 && tokenId <= _tokenCount, "Unknown token");
        _tokenURIs[tokenId] = tokenURI_;
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    function setRoyalty(address payable receiver, uint16 bps) external onlyOwner {
        require(bps <= 5000, "Royalty too high");
        _royaltyReceiver = receiver;
        _royaltyBPS = bps;
        emit RoyaltyUpdated(receiver, bps);
    }

    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (_royaltyReceiver, (salePrice * _royaltyBPS) / 10000);
    }

    /// @dev Indexer-compatible shape (collection-level royalty mirrored per token).
    function getRoyalties(uint256)
        external
        view
        returns (address payable[] memory receivers, uint256[] memory basisPoints)
    {
        if (_royaltyBPS == 0 || _royaltyReceiver == address(0)) {
            receivers = new address payable[](0);
            basisPoints = new uint256[](0);
            return (receivers, basisPoints);
        }
        receivers = new address payable[](1);
        basisPoints = new uint256[](1);
        receivers[0] = _royaltyReceiver;
        basisPoints[0] = _royaltyBPS;
    }

    // === Marketplace Management ===

    /**
     * @notice Approve or revoke a marketplace/auction house address to call deliver()
     * @param marketplace The marketplace contract address
     * @param approved True to approve, false to revoke
     */
    function setMarketplaceApproval(address marketplace, bool approved) external onlyOwner {
        require(marketplace != address(0), "Invalid marketplace");
        _approvedMarketplaces[marketplace] = approved;
        emit MarketplaceApproved(marketplace, approved);
    }

    /**
     * @notice Check if a marketplace is approved to call deliver()
     * @param marketplace The marketplace contract address
     * @return True if approved, false otherwise
     */
    function isMarketplaceApproved(address marketplace) external view returns (bool) {
        return _approvedMarketplaces[marketplace];
    }

    // === Lazy Delivery ===

    /**
     * @notice Deliver (lazy mint) tokens to a buyer through an approved marketplace
     * @dev This function is called by the marketplace/auction house during settlement.
     *      Tokens are minted directly to the buyer's address.
     * @param listingId The marketplace listing ID
     * @param to The buyer's address
     * @param assetId The token ID to mint
     * @param payableCount The number of tokens to mint
     * @param payableAmount The sale price (unused in this implementation)
     * @param payableERC20 The payment token address (unused in this implementation)
     * @param index Optional index (unused in this implementation)
     */
    function deliver(
        uint40 listingId,
        address to,
        uint256 assetId,
        uint24 payableCount,
        uint256 payableAmount,
        address payableERC20,
        uint256 index
    ) external override nonReentrant {
        require(_approvedMarketplaces[msg.sender], "Caller not approved marketplace");
        require(payableCount > 0, "Amount must be > 0");
        require(to != address(0), "Cannot deliver to zero address");

        // For lazy delivery, if the token doesn't exist yet, we create it
        // If it exists and has capacity, we mint additional supply
        if (totalMinted[assetId] == 0) {
            // New token - must have been prepared with metadata
            require(bytes(_tokenURIs[assetId]).length > 0, "Token URI not set");
            ++_tokenCount;
        }

        uint256 cap = maxSupply[assetId];
        if (cap > 0) {
            require(totalMinted[assetId] + payableCount <= cap, "Exceeds max supply");
        }

        totalMinted[assetId] += payableCount;
        _mint(to, assetId, payableCount, "");

        emit LazyDelivered(listingId, to, assetId, payableCount);
        emit SupplyMinted(to, assetId, payableCount, cap);
    }

    /**
     * @notice Prepare token metadata for lazy delivery (without minting)
     * @dev Sets the URI and supply cap for a future lazy mint. Token ID is assigned but no supply exists yet.
     * @param tokenURI_ The metadata URI for the token
     * @param maxSupply_ The maximum supply cap (0 for unlimited)
     * @return tokenId The assigned token ID
     */
    function prepareLazyToken(string calldata tokenURI_, uint256 maxSupply_)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        require(bytes(tokenURI_).length > 0, "URI required");
        ++_tokenCount;
        tokenId = _tokenCount;
        _tokenURIs[tokenId] = tokenURI_;
        maxSupply[tokenId] = maxSupply_;
        // totalMinted remains 0 until deliver() is called
    }

    // === Multi-Recipient Airdrop ===

    /**
     * @notice Airdrop tokens to multiple recipients in a single transaction
     * @dev For ERC1155, each recipient receives the specified token ID and amount.
     *      Useful for distributing editions to multiple collectors at once.
     * @param recipients Array of addresses to receive tokens
     * @param tokenId The token ID to airdrop (must exist or be prepared)
     * @param amounts Array of amounts corresponding to each recipient
     *
     * Gas considerations:
     * - ~35k gas per recipient (approximation for ERC1155)
     * - Recommended max batch size: 300-400 recipients per transaction
     * - For larger airdrops, split into multiple transactions
     */
    function airdrop(address[] calldata recipients, uint256 tokenId, uint256[] calldata amounts)
        external
        onlyOwner
        nonReentrant
    {
        require(recipients.length > 0, "No recipients");
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length <= 500, "Batch too large"); // Safety limit
        require(tokenId > 0 && tokenId <= _tokenCount, "Unknown token");

        uint256 totalAmount;
        for (uint256 i; i < amounts.length;) {
            require(amounts[i] > 0, "Amount must be > 0");
            totalAmount += amounts[i];
            unchecked {
                ++i;
            }
        }

        uint256 cap = maxSupply[tokenId];
        if (cap > 0) {
            require(totalMinted[tokenId] + totalAmount <= cap, "Exceeds max supply");
        }

        totalMinted[tokenId] += totalAmount;

        for (uint256 i; i < recipients.length;) {
            require(recipients[i] != address(0), "Invalid recipient");
            _mint(recipients[i], tokenId, amounts[i], "");
            emit SupplyMinted(recipients[i], tokenId, amounts[i], cap);
            unchecked {
                ++i;
            }
        }
    }

    // === Blind Mint / Reveal ===

    /**
     * @notice Set up blind minting with a placeholder URI and metadata commitment
     * @param placeholder The URI to use for all tokens until reveal
     * @param metadataHash keccak256 hash of the final metadata
     */
    function setBlindMintConfig(string calldata placeholder, bytes32 metadataHash) external onlyOwner {
        require(!_isRevealed, "Already revealed");
        require(bytes(placeholder).length > 0, "Placeholder required");
        require(metadataHash != bytes32(0), "Metadata hash required");
        _placeholderURI = placeholder;
        _metadataCommitment = metadataHash;
    }

    /**
     * @notice Reveal the collection by setting the real base URI
     * @param revealedBaseURI The actual base URI for all tokens
     * @param verificationSalt Salt used in the commitment hash
     */
    function reveal(string calldata revealedBaseURI, bytes32 verificationSalt) external onlyOwner {
        require(!_isRevealed, "Already revealed");
        require(bytes(_placeholderURI).length > 0, "Blind mint not configured");
        
        bytes32 computedHash = keccak256(abi.encodePacked(revealedBaseURI, verificationSalt));
        require(computedHash == _metadataCommitment, "Metadata does not match commitment");
        
        _isRevealed = true;
        _baseURI = revealedBaseURI;
        
        emit Revealed(revealedBaseURI, _metadataCommitment);
    }

    function isRevealed() external view returns (bool) {
        return _isRevealed;
    }

    function placeholderURI() external view returns (string memory) {
        return _placeholderURI;
    }

    function metadataCommitment() external view returns (bytes32) {
        return _metadataCommitment;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || interfaceId == type(ILazyDelivery).interfaceId
            || super.supportsInterface(interfaceId);
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
}
