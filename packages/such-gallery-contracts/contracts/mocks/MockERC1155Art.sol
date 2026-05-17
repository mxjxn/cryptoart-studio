// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155Art is ERC1155 {
    uint256 private _nextTokenId;

    constructor() ERC1155("https://mock.art/{id}.json") {}

    function mint(address to, uint256 amount) external returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _mint(to, tokenId, amount, "");
        return tokenId;
    }

    function mintWithTokenId(address to, uint256 tokenId, uint256 amount) external {
        _mint(to, tokenId, amount, "");
    }
}
