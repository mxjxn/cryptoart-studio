// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

interface ISuchCollection1155 {
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event SupplyMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 maxSupply);
    event RoyaltyUpdated(address receiver, uint16 bps);
    event BaseURIUpdated(string baseURI);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function maxSupply(uint256 tokenId) external view returns (uint256);
    function totalMinted(uint256 tokenId) external view returns (uint256);

    function mint(address to, uint256 amount, uint256 maxSupply_, string calldata tokenURI_)
        external
        returns (uint256 tokenId);

    function mintExisting(address to, uint256 tokenId, uint256 amount) external;

    function setTokenURI(uint256 tokenId, string calldata tokenURI_) external;
    function setBaseURI(string calldata baseURI_) external;
    function setRoyalty(address payable receiver, uint16 bps) external;
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
    function getRoyalties(uint256 tokenId)
        external
        view
        returns (address payable[] memory receivers, uint256[] memory basisPoints);
}
