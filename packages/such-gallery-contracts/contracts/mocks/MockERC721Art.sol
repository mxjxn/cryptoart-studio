// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721Art is ERC721 {
    uint256 private _nextTokenId;

    constructor() ERC721("Mock Art", "MART") {}

    function mint(address to) external returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function mintWithTokenId(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }
}
