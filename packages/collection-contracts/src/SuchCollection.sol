// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {Ownable} from "openzeppelin/access/Ownable.sol";
import {IERC721Enumerable} from "openzeppelin/token/ERC721/extensions/IERC721Enumerable.sol";
import {IERC165} from "openzeppelin/utils/introspection/IERC165.sol";
import {ERC721Base} from "./token/ERC721/ERC721Base.sol";
import {ERC721Enumerable} from "./token/ERC721/ERC721Enumerable.sol";
import {ERC721CreatorCore} from "./core/ERC721CreatorCore.sol";
import {ILazyDelivery} from "./interfaces/ILazyDelivery.sol";

contract SuchCollection is ERC721Enumerable, ERC721CreatorCore, Ownable, ILazyDelivery {
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event RoyaltyUpdated(address receiver, uint16 bps);
    event BaseURIUpdated(string baseURI);
    event MarketplaceApproved(address indexed marketplace, bool approved);
    event LazyDelivered(uint40 indexed listingId, address indexed to, uint256 indexed tokenId);

    address payable private _royaltyReceiver;
    uint16 private _royaltyBPS;
    
    // Authorized marketplace/auction house addresses that can call deliver()
    mapping(address => bool) private _approvedMarketplaces;

    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        address payable royaltyReceiver_,
        uint16 royaltyBPS_
    ) ERC721Base(name_, symbol_) Ownable(owner_) {
        _royaltyReceiver = royaltyReceiver_;
        _royaltyBPS = royaltyBPS_;
        if (royaltyBPS_ > 0) {
            address payable[] memory receivers = new address payable[](1);
            uint256[] memory bps = new uint256[](1);
            receivers[0] = royaltyReceiver_;
            bps[0] = royaltyBPS_;
            _setRoyaltiesExtension(address(0), receivers, bps);
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721Enumerable, IERC165) returns (bool) {
        return interfaceId == type(IERC721Enumerable).interfaceId 
            || interfaceId == type(ILazyDelivery).interfaceId
            || interfaceId == _ROYALTY_INTERFACE_ID()
            || super.supportsInterface(interfaceId);
    }

    function mint(address to, string calldata uri) external nonReentrant returns (uint256) {
        require(msg.sender == owner(), "Only owner");
        return _mintBase(to, uri);
    }

    function mintBatch(address to, string[] calldata uris) external nonReentrant returns (uint256[] memory tokenIds) {
        require(msg.sender == owner(), "Only owner");
        tokenIds = new uint256[](uris.length);
        uint256 firstTokenId = _tokenCount + 1;
        _tokenCount += uris.length;

        for (uint256 i; i < uris.length;) {
            tokenIds[i] = _mintBase(to, uris[i], firstTokenId + i);
            unchecked {
                ++i;
            }
        }
    }

    function mintExtension(address to, string calldata uri) external nonReentrant returns (uint256) {
        requireExtension();
        return _mintExtension(to, uri);
    }

    function mintExtensionBatch(address to, string[] calldata uris)
        external
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        requireExtension();
        tokenIds = new uint256[](uris.length);
        uint256 firstTokenId = _tokenCount + 1;
        _tokenCount += uris.length;

        for (uint256 i; i < uris.length;) {
            tokenIds[i] = _mintExtension(to, uris[i], firstTokenId + i);
            unchecked {
                ++i;
            }
        }
    }

    function burn(uint256 tokenId) external nonReentrant {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner or approved");
        address tokenOwner = ownerOf(tokenId);
        _burn(tokenId);
        _postBurn(tokenOwner, tokenId);
    }

    function registerExtension(address extension, string calldata baseURI) external onlyOwner {
        _registerExtension(extension, baseURI);
    }

    function unregisterExtension(address extension) external onlyOwner {
        _unregisterExtension(extension);
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _setBaseTokenURI(baseURI);
        emit BaseURIUpdated(baseURI);
    }

    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        _setTokenURI(tokenId, uri);
    }

    /**
     * @notice Preset token URI for a future lazy mint
     * @dev This allows setting the URI for a token before it exists, which is necessary for lazy listings.
     *      The token will be minted with this URI when deliver() is called by the marketplace.
     * @param tokenId The token ID to preset the URI for
     * @param uri The token metadata URI
     */
    function setTokenURIForLazyMint(uint256 tokenId, string calldata uri) external onlyOwner {
        require(bytes(uri).length > 0, "URI required");
        require(!_exists(tokenId), "Token already minted");
        _tokenURIs[tokenId] = uri;
    }

    function setTokenURIPrefix(string calldata prefix) external onlyOwner {
        _setTokenURIPrefix(prefix);
    }

    function setRoyalty(address payable receiver, uint16 bps) external onlyOwner {
        require(bps <= 5000, "Royalty too high");
        _royaltyReceiver = receiver;
        _royaltyBPS = bps;
        address payable[] memory receivers = new address payable[](1);
        uint256[] memory basisPoints = new uint256[](1);
        receivers[0] = receiver;
        basisPoints[0] = bps;
        _setRoyaltiesExtension(address(0), receivers, basisPoints);
        emit RoyaltyUpdated(receiver, bps);
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256) {
        return _getRoyaltyInfo(tokenId, salePrice);
    }

    function getRoyalties(uint256 tokenId) external view returns (address payable[] memory, uint256[] memory) {
        return _getRoyalties(tokenId);
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        return _tokenURI(tokenId);
    }

    function tokenExtension(uint256 tokenId) external view returns (address) {
        require(_exists(tokenId), "Nonexistent token");
        address extension = _tokenExtension(tokenId);
        require(extension != address(0), "No extension for token");
        return extension;
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
     * @notice Deliver (lazy mint) a token to a buyer through an approved marketplace
     * @dev This function is called by the marketplace/auction house during settlement.
     *      The token is minted directly to the buyer's address.
     * @param listingId The marketplace listing ID
     * @param to The buyer's address
     * @param assetId The token ID to mint
     * @param payableCount Must be 1 for ERC721
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
        require(payableCount == 1, "ERC721 can only deliver 1 token");
        require(!_exists(assetId), "Token already minted");
        require(to != address(0), "Cannot deliver to zero address");

        // Update token count if assetId is beyond current count
        if (assetId > _tokenCount) {
            _tokenCount = assetId;
        }

        // Mint the token to the buyer
        // For lazy delivery, we use the assetId as the tokenId
        // The token URI should have been preset by the artist when creating the lazy listing
        _preMintBase(to, assetId);
        _safeMint(to, assetId, 0);

        emit LazyDelivered(listingId, to, assetId);
        emit Minted(to, assetId, _tokenURIs[assetId]);
    }

    // === Multi-Recipient Airdrop ===

    /**
     * @notice Airdrop tokens to multiple recipients in a single transaction
     * @dev Mints one token per recipient. Gas-efficient for distributing to many addresses.
     * @param recipients Array of addresses to receive tokens
     * @param uris Array of token URIs corresponding to each recipient
     * @return tokenIds Array of minted token IDs
     *
     * Gas considerations:
     * - ~50k gas per recipient (approximation)
     * - Recommended max batch size: 200-300 recipients per transaction
     * - For larger airdrops, split into multiple transactions
     */
    function airdrop(address[] calldata recipients, string[] calldata uris)
        external
        onlyOwner
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        require(recipients.length > 0, "No recipients");
        require(recipients.length == uris.length, "Length mismatch");
        require(recipients.length <= 500, "Batch too large"); // Safety limit

        tokenIds = new uint256[](recipients.length);
        uint256 firstTokenId = _tokenCount + 1;
        _tokenCount += recipients.length;

        for (uint256 i; i < recipients.length;) {
            require(recipients[i] != address(0), "Invalid recipient");
            uint256 tokenId = firstTokenId + i;
            tokenIds[i] = tokenId;
            
            _preMintBase(recipients[i], tokenId);
            _safeMint(recipients[i], tokenId, 0);
            
            if (bytes(uris[i]).length > 0) {
                _tokenURIs[tokenId] = uris[i];
            }
            
            emit Minted(recipients[i], tokenId, uris[i]);
            
            unchecked {
                ++i;
            }
        }
    }

    function _mintBase(address to, string memory uri) internal returns (uint256) {
        return _mintBase(to, uri, 0);
    }

    function _mintBase(address to, string memory uri, uint256 tokenId) internal returns (uint256) {
        if (tokenId == 0) {
            ++_tokenCount;
            tokenId = _tokenCount;
        }

        _preMintBase(to, tokenId);

        _safeMint(to, tokenId, 0);

        if (bytes(uri).length > 0) {
            _tokenURIs[tokenId] = uri;
        }

        emit Minted(to, tokenId, uri);
        return tokenId;
    }

    function _mintExtension(address to, string memory uri) internal returns (uint256) {
        return _mintExtension(to, uri, 0);
    }

    function _mintExtension(address to, string memory uri, uint256 tokenId) internal returns (uint256) {
        if (tokenId == 0) {
            ++_tokenCount;
            tokenId = _tokenCount;
        }

        _preMintExtension(to, tokenId);

        _safeMint(to, tokenId, uint96(_extensionToIndex[msg.sender]));

        if (bytes(uri).length > 0) {
            _tokenURIs[tokenId] = uri;
        }

        emit Minted(to, tokenId, uri);
        return tokenId;
    }

    function _postBurn(address, uint256 tokenId) internal {
        if (bytes(_tokenURIs[tokenId]).length != 0) {
            delete _tokenURIs[tokenId];
        }
    }

    function _tokenExtension(uint256 tokenId) internal view override returns (address) {
        uint16 extensionIndex = uint16(_tokenData[tokenId].data);
        if (extensionIndex == 0) return address(0);
        return _indexToExtension[extensionIndex];
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint96 tokenData)
        internal
        virtual
        override(ERC721Enumerable)
    {
        ERC721Enumerable._beforeTokenTransfer(from, to, tokenId, tokenData);
    }
}
