// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title IERC6551Account
 * @notice Interface for ERC-6551 Token Bound Accounts
 * @dev See https://eips.ethereum.org/EIPS/eip-6551
 */
interface IERC6551Account {
    /**
     * @dev Receives and executes a call from the NFT owner
     * @param to Target address for the call
     * @param value ETH value to send
     * @param data Calldata for the call
     * @return result The return data from the call
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result);

    /**
     * @dev Returns the token that owns this account
     * @return chainId The chain ID of the NFT
     * @return tokenContract The NFT contract address
     * @return tokenId The NFT token ID
     */
    function token()
        external
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId);

    /**
     * @dev Returns the owner of the NFT (and thus this account)
     * @return The address of the NFT owner
     */
    function owner() external view returns (address);

    /**
     * @dev Returns the current nonce for replay protection
     * @return The current nonce
     */
    function state() external view returns (uint256);

    /**
     * @dev ERC-165 interface support
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/**
 * @title IERC6551Executable
 * @notice Extended interface for executable token bound accounts
 */
interface IERC6551Executable {
    /**
     * @dev Executes a batch of calls
     * @param operations Array of operations to execute
     * @return results Array of return data from each call
     */
    function executeBatch(
        Operation[] calldata operations
    ) external payable returns (bytes[] memory results);

    struct Operation {
        address to;
        uint256 value;
        bytes data;
    }
}
