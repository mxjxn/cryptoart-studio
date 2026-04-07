// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Constants
 * @notice Deployment addresses for Party Gallery contracts
 */
library Constants {
    // =============================================================
    //                    ERC-6551 ADDRESSES
    // =============================================================

    /// @notice ERC-6551 Registry (same on all EVM chains)
    /// @dev See: https://docs.tokenbound.org/contracts/deployments
    address constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;

    // =============================================================
    //                 PARTY PROTOCOL ADDRESSES
    // =============================================================

    // Base Mainnet
    address constant PARTY_FACTORY_BASE = 0x26A8b590D7B8d31706C46D2f19FA53A12Dd6b55f;
    address constant PARTY_HELPERS_BASE = 0x375a67b4862DF71f8e2f61bD12EC5BE6E95aEA77;

    // Base Sepolia
    address constant PARTY_FACTORY_BASE_SEPOLIA = 0x26A8b590D7B8d31706C46D2f19FA53A12Dd6b55f;

    // =============================================================
    //                   MARKETPLACE ADDRESSES
    // =============================================================

    // Base Mainnet
    address constant MARKETPLACE_BASE = 0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9;

    // =============================================================
    //                  PARTY GALLERY ADDRESSES
    // =============================================================

    // Filled after deployment
    // Base Mainnet
    address constant GALLERY_NFT_BASE = address(0);
    address constant GALLERY_ACCOUNT_IMPL_BASE = address(0);
    address constant GALLERY_FACTORY_BASE = address(0);

    // Base Sepolia
    address constant GALLERY_NFT_BASE_SEPOLIA = address(0);
    address constant GALLERY_ACCOUNT_IMPL_BASE_SEPOLIA = address(0);
    address constant GALLERY_FACTORY_BASE_SEPOLIA = address(0);
}
