// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "../GalleryAccount.sol";

/**
 * @title MockERC6551Registry
 * @notice Test double for the ERC-6551 singleton registry.
 *         Actually deploys GalleryAccount instances so receiver hooks work.
 *         Uses hash-based deterministic addresses (not real CREATE2).
 *
 *         Two modes:
 *         - account() returns deterministic hash-based address (counterfactual)
 *         - createAccount() deploys a fresh GalleryAccount and tracks it
 *         The deployed address differs from the counterfactual one, which is
 *         expected in test environments. Production uses real CREATE2 where
 *         they match.
 */
contract MockERC6551Registry {
    event ERC6551AccountCreated(
        address account,
        address indexed implementation,
        bytes32 salt,
        uint256 chainId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );

    mapping(bytes32 => address) public deployedAccounts;

    function _accountHash(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(implementation, salt, chainId, tokenContract, tokenId)
        );
    }

    /**
     * @notice Deterministic address derived from the 5-tuple.
     *         Returns deployed address if available, otherwise hash-based address.
     */
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) public view returns (address) {
        bytes32 h = _accountHash(implementation, salt, chainId, tokenContract, tokenId);
        address existing = deployedAccounts[h];
        if (existing != address(0)) return existing;

        // Counterfactual: return deterministic hash address
        return address(uint160(uint256(h)));
    }

    /**
     * @notice Create a token bound account. Deploys a fresh GalleryAccount.
     *         In production, the registry deploys an EIP-1167 minimal proxy.
     */
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address) {
        bytes32 h = _accountHash(implementation, salt, chainId, tokenContract, tokenId);

        if (deployedAccounts[h] != address(0)) {
            return deployedAccounts[h];
        }

        GalleryAccount acct = new GalleryAccount();
        address addr = address(acct);

        deployedAccounts[h] = addr;
        emit ERC6551AccountCreated(addr, implementation, salt, chainId, tokenContract, tokenId);

        return addr;
    }
}
