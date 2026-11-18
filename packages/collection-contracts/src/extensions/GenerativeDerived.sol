// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Stable identifiers for on-chain derived values (extensible via registration).
library GenerativeDerived {
    bytes32 internal constant TOKEN_ID = keccak256("cryptoart.derived.tokenId");
    bytes32 internal constant SEED = keccak256("cryptoart.derived.seed");
    bytes32 internal constant MINT_BLOCK = keccak256("cryptoart.derived.mintBlock");
    bytes32 internal constant MINT_TIMESTAMP = keccak256("cryptoart.derived.mintTimestamp");
    bytes32 internal constant MINT_BLOCK_HASH = keccak256("cryptoart.derived.mintBlockHash");
    bytes32 internal constant MINT_INDEX = keccak256("cryptoart.derived.mintIndex");
    bytes32 internal constant EXTENSION_MINT_COUNT = keccak256("cryptoart.derived.extensionMintCount");
    bytes32 internal constant CURRENT_BLOCK = keccak256("cryptoart.derived.currentBlock");
    bytes32 internal constant CURRENT_TIMESTAMP = keccak256("cryptoart.derived.currentTimestamp");

    function builtinKeys() internal pure returns (bytes32[] memory keys) {
        keys = new bytes32[](9);
        keys[0] = TOKEN_ID;
        keys[1] = SEED;
        keys[2] = MINT_BLOCK;
        keys[3] = MINT_TIMESTAMP;
        keys[4] = MINT_BLOCK_HASH;
        keys[5] = MINT_INDEX;
        keys[6] = EXTENSION_MINT_COUNT;
        keys[7] = CURRENT_BLOCK;
        keys[8] = CURRENT_TIMESTAMP;
    }
}