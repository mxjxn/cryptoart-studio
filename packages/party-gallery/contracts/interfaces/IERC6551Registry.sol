// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title IERC6551Registry
 * @notice Interface for the ERC-6551 Token Bound Account Registry
 * @dev See https://eips.ethereum.org/EIPS/eip-6551
 */
interface IERC6551Registry {
    /**
     * @dev Emitted when a token bound account is created
     */
    event ERC6551AccountCreated(
        address account,
        address indexed implementation,
        bytes32 salt,
        uint256 chainId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );

    /**
     * @dev Creates a token bound account for an NFT
     * @param implementation The address of the account implementation
     * @param salt Unique salt for account creation
     * @param chainId The chain ID where the NFT exists
     * @param tokenContract The NFT contract address
     * @param tokenId The NFT token ID
     * @return account The address of the created account
     */
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address account);

    /**
     * @dev Computes the address of a token bound account
     * @param implementation The address of the account implementation
     * @param salt Unique salt for account creation
     * @param chainId The chain ID where the NFT exists
     * @param tokenContract The NFT contract address
     * @param tokenId The NFT token ID
     * @return account The computed address of the account
     */
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address account);
}
