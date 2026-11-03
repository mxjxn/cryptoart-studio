// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {ERC1155} from "openzeppelin/token/ERC1155/ERC1155.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin/utils/ReentrancyGuard.sol";
import {IERC2981} from "openzeppelin/interfaces/IERC2981.sol";
import {IERC165} from "openzeppelin/utils/introspection/IERC165.sol";

/// @notice Multi-supply collection. Each token id has a supply that is limited (maxSupply > 0)
///         or open (maxSupply == 0). Not numbered editions.
contract SuchCollection1155 is ERC1155, Ownable, ReentrancyGuard, IERC2981 {
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event SupplyMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 maxSupply);
    event RoyaltyUpdated(address receiver, uint16 bps);
    event BaseURIUpdated(string baseURI);

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

    /// @notice Mint additional supply of an existing token id (open or under cap).
    function mintExisting(address to, uint256 tokenId, uint256 amount) external onlyOwner nonReentrant {
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

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
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
