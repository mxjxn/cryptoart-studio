// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC6551Registry} from "./interfaces/IERC6551Registry.sol";

/**
 * @title GalleryNFT
 * @notice ERC-721 NFT representing a curated gallery
 * @dev Each GalleryNFT has an associated 6551 Token Bound Account that holds the collection
 *
 * Architecture:
 *   Party DAO ──owns──▶ GalleryNFT ──has──▶ 6551 Account ──holds──▶ NFTs
 *
 * The Party DAO (or any owner) can control the 6551 account to:
 *   - Bid on auctions
 *   - Purchase NFTs
 *   - List NFTs for sale
 *   - Transfer NFTs
 */
contract GalleryNFT {
    // =============================================================
    //                           ERRORS
    // =============================================================

    error NotAuthorized();
    error InvalidTokenId();
    error TransferToZeroAddress();
    error TokenAlreadyMinted();
    error ApprovalToCurrentOwner();
    error InvalidApprovalTarget();

    // =============================================================
    //                           EVENTS
    // =============================================================

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event GalleryCreated(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed account,
        string name
    );
    event GalleryMetadataUpdated(uint256 indexed tokenId, string name, string description);

    // =============================================================
    //                           STRUCTS
    // =============================================================

    struct GalleryMetadata {
        string name;
        string description;
        string externalUrl;
        uint40 createdAt;
    }

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice Contract name
    string public constant name = "CryptoArt Gallery";

    /// @notice Contract symbol
    string public constant symbol = "GALLERY";

    /// @notice ERC-6551 registry address
    IERC6551Registry public immutable registry;

    /// @notice ERC-6551 account implementation address
    address public immutable accountImplementation;

    /// @notice Total number of galleries created
    uint256 public totalSupply;

    /// @notice Token ID to owner mapping
    mapping(uint256 => address) private _owners;

    /// @notice Owner to balance mapping
    mapping(address => uint256) private _balances;

    /// @notice Token ID to approved address mapping
    mapping(uint256 => address) private _tokenApprovals;

    /// @notice Owner to operator approvals mapping
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /// @notice Token ID to gallery metadata
    mapping(uint256 => GalleryMetadata) public galleries;

    /// @notice Token ID to 6551 account address (cached for gas efficiency)
    mapping(uint256 => address) public galleryAccounts;

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /**
     * @notice Initialize the GalleryNFT contract
     * @param _registry The ERC-6551 registry address
     * @param _accountImplementation The account implementation to use for galleries
     */
    constructor(address _registry, address _accountImplementation) {
        registry = IERC6551Registry(_registry);
        accountImplementation = _accountImplementation;
    }

    // =============================================================
    //                      GALLERY FUNCTIONS
    // =============================================================

    /**
     * @notice Create a new gallery
     * @param name_ The gallery name
     * @param description_ The gallery description
     * @param externalUrl_ External URL for the gallery
     * @return tokenId The new gallery's token ID
     * @return account The gallery's 6551 account address
     */
    function createGallery(
        string calldata name_,
        string calldata description_,
        string calldata externalUrl_
    ) external returns (uint256 tokenId, address account) {
        tokenId = ++totalSupply;

        // Mint the NFT to the caller
        _mint(msg.sender, tokenId);

        // Store metadata
        galleries[tokenId] = GalleryMetadata({
            name: name_,
            description: description_,
            externalUrl: externalUrl_,
            createdAt: uint40(block.timestamp)
        });

        // Create the 6551 account for this gallery
        account = registry.createAccount(
            accountImplementation,
            bytes32(0), // salt
            block.chainid,
            address(this),
            tokenId
        );

        galleryAccounts[tokenId] = account;

        emit GalleryCreated(tokenId, msg.sender, account, name_);
    }

    /**
     * @notice Create a gallery owned by a specific address (e.g., a Party)
     * @param owner_ The address that will own the gallery
     * @param name_ The gallery name
     * @param description_ The gallery description
     * @param externalUrl_ External URL for the gallery
     * @return tokenId The new gallery's token ID
     * @return account The gallery's 6551 account address
     */
    function createGalleryFor(
        address owner_,
        string calldata name_,
        string calldata description_,
        string calldata externalUrl_
    ) external returns (uint256 tokenId, address account) {
        if (owner_ == address(0)) revert TransferToZeroAddress();

        tokenId = ++totalSupply;

        // Mint the NFT to the specified owner
        _mint(owner_, tokenId);

        // Store metadata
        galleries[tokenId] = GalleryMetadata({
            name: name_,
            description: description_,
            externalUrl: externalUrl_,
            createdAt: uint40(block.timestamp)
        });

        // Create the 6551 account for this gallery
        account = registry.createAccount(
            accountImplementation,
            bytes32(0), // salt
            block.chainid,
            address(this),
            tokenId
        );

        galleryAccounts[tokenId] = account;

        emit GalleryCreated(tokenId, owner_, account, name_);
    }

    /**
     * @notice Update gallery metadata
     * @param tokenId The gallery token ID
     * @param name_ New name
     * @param description_ New description
     * @param externalUrl_ New external URL
     */
    function updateGalleryMetadata(
        uint256 tokenId,
        string calldata name_,
        string calldata description_,
        string calldata externalUrl_
    ) external {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotAuthorized();

        GalleryMetadata storage gallery = galleries[tokenId];
        gallery.name = name_;
        gallery.description = description_;
        gallery.externalUrl = externalUrl_;

        emit GalleryMetadataUpdated(tokenId, name_, description_);
    }

    /**
     * @notice Get the 6551 account for a gallery (computes if not cached)
     * @param tokenId The gallery token ID
     * @return The account address
     */
    function getGalleryAccount(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert InvalidTokenId();

        address cached = galleryAccounts[tokenId];
        if (cached != address(0)) return cached;

        return registry.account(
            accountImplementation,
            bytes32(0),
            block.chainid,
            address(this),
            tokenId
        );
    }

    // =============================================================
    //                       ERC-721 FUNCTIONS
    // =============================================================

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert TransferToZeroAddress();
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        if (owner == address(0)) revert InvalidTokenId();
        return owner;
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        if (to == owner) revert ApprovalToCurrentOwner();
        if (msg.sender != owner && !_operatorApprovals[owner][msg.sender]) {
            revert NotAuthorized();
        }
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        if (_owners[tokenId] == address(0)) revert InvalidTokenId();
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert InvalidApprovalTarget();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotAuthorized();
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public {
        transferFrom(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, data);
    }

    // =============================================================
    //                      ERC-165 FUNCTIONS
    // =============================================================

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x80ac58cd || // ERC-721
            interfaceId == 0x5b5e139f;   // ERC-721 Metadata
    }

    // =============================================================
    //                     METADATA FUNCTIONS
    // =============================================================

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert InvalidTokenId();

        GalleryMetadata memory gallery = galleries[tokenId];

        // Return a data URI with JSON metadata
        return string(
            abi.encodePacked(
                'data:application/json,{"name":"',
                gallery.name,
                '","description":"',
                gallery.description,
                '","external_url":"',
                gallery.externalUrl,
                '"}'
            )
        );
    }

    // =============================================================
    //                     INTERNAL FUNCTIONS
    // =============================================================

    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) revert TransferToZeroAddress();
        if (_owners[tokenId] != address(0)) revert TokenAlreadyMinted();

        _balances[to]++;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        if (ownerOf(tokenId) != from) revert NotAuthorized();
        if (to == address(0)) revert TransferToZeroAddress();

        delete _tokenApprovals[tokenId];

        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (
            spender == owner ||
            getApproved(tokenId) == spender ||
            isApprovedForAll(owner, spender)
        );
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) {
                    revert("ERC721: transfer to non ERC721Receiver");
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}
