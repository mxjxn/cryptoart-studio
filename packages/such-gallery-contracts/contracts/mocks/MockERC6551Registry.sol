// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/**
 * @title MockERC6551Registry
 * @notice Test double for the ERC-6551 singleton registry.
 *         Simulates CREATE2 address derivation and account creation.
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

    // Track created accounts so createAccount only deploys once
    mapping(bytes32 => bool) public created;

    /**
     * @notice Deterministic address derived from the 5-tuple.
     *         Uses a simplified hash — real registry uses CREATE2.
     */
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

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) public view returns (address) {
        return address(uint160(uint256(_accountHash(implementation, salt, chainId, tokenContract, tokenId))));
    }

    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address) {
        bytes32 h = _accountHash(implementation, salt, chainId, tokenContract, tokenId);
        address addr = address(uint160(uint256(h)));

        if (!created[h]) {
            created[h] = true;
            emit ERC6551AccountCreated(addr, implementation, salt, chainId, tokenContract, tokenId);
        }

        return addr;
    }
}
