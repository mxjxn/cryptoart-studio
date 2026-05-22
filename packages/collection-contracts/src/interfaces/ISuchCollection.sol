// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {IERC721} from "openzeppelin/token/ERC721/IERC721.sol";
import {IERC721Metadata} from "openzeppelin/token/ERC721/extensions/IERC721Metadata.sol";
import {IERC721Enumerable} from "openzeppelin/token/ERC721/extensions/IERC721Enumerable.sol";

interface ISuchCollection is IERC721, IERC721Metadata, IERC721Enumerable {
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event RoyaltyUpdated(address receiver, uint16 bps);
    event BaseURIUpdated(string baseURI);

    function mint(address to, string calldata uri) external returns (uint256);
    function mintBatch(address to, string[] calldata uris) external returns (uint256[] memory);
    function mintExtension(address to, string calldata uri) external returns (uint256);
    function mintExtensionBatch(address to, string[] calldata uris) external returns (uint256[] memory);
    function burn(uint256 tokenId) external;

    function registerExtension(address extension, string calldata baseURI) external;
    function unregisterExtension(address extension) external;
    function getExtensions() external view returns (address[] memory);

    function setBaseURI(string calldata baseURI) external;
    function setTokenURI(uint256 tokenId, string calldata uri) external;
    function setTokenURIPrefix(string calldata prefix) external;

    function setRoyalty(address payable receiver, uint16 bps) external;
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
    function getRoyalties(uint256 tokenId) external view returns (address payable[] memory, uint256[] memory);

    function tokenExtension(uint256 tokenId) external view returns (address);
}
