// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "../GalleryAccount.sol";

/**
 * @title MockGalleryAccount
 * @notice Testable GalleryAccount with hardcoded token context.
 *         In production, the ERC-6551 registry deploys an EIP-1167 proxy
 *         with context embedded in bytecode. This mock overrides token()
 *         so tests work without the real proxy pattern.
 */
contract MockGalleryAccount is GalleryAccount {
    uint256 private _chainId;
    address private _tokenContract;
    uint256 private _tokenId;

    constructor(uint256 chainId_, address tokenContract_, uint256 tokenId_) {
        _chainId = chainId_;
        _tokenContract = tokenContract_;
        _tokenId = tokenId_;
    }

    function token() public view override returns (uint256, address, uint256) {
        return (_chainId, _tokenContract, _tokenId);
    }
}
