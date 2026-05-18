// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/**
 * @title IERC6551Registry
 * @notice Minimal interface for the ERC-6551 singleton registry.
 *         The canonical registry is deployed at
 *         0x000000006551c19487814612e58FE06813775758 on all EVM chains.
 */
interface IERC6551Registry {
    event ERC6551AccountCreated(
        address account,
        address indexed implementation,
        bytes32 salt,
        uint256 chainId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );

    error AccountCreationFailed();

    /**
     * @notice Create a token bound account for an NFT (CREATE2).
     *         Idempotent — returns existing address if already deployed.
     */
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address);

    /**
     * @notice Compute the token bound account address without deploying.
     */
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address);
}
