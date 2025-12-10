// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC6551Account, IERC6551Executable} from "./interfaces/IERC6551Account.sol";

/**
 * @title GalleryAccount
 * @notice ERC-6551 Token Bound Account implementation for galleries
 * @dev This account is controlled by whoever owns the GalleryNFT
 *
 * Key capabilities:
 *   - Hold ETH, ERC20s, and NFTs
 *   - Execute arbitrary calls (bid, purchase, list, transfer)
 *   - Batch execute multiple operations
 *   - ERC-1271 signature validation (for off-chain signatures)
 *
 * When owned by a Party DAO:
 *   - Party members propose actions via governance
 *   - Passed proposals execute calls through this account
 */
contract GalleryAccount is IERC6551Account, IERC6551Executable {
    // =============================================================
    //                           ERRORS
    // =============================================================

    error NotAuthorized();
    error InvalidOperation();
    error CallFailed(uint256 index, bytes reason);

    // =============================================================
    //                           EVENTS
    // =============================================================

    event Executed(address indexed target, uint256 value, bytes data, bytes result);
    event BatchExecuted(uint256 count);
    event Received(address indexed from, uint256 amount);

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice Internal nonce for replay protection
    uint256 private _state;

    // =============================================================
    //                       RECEIVE / FALLBACK
    // =============================================================

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // =============================================================
    //                      EXECUTION FUNCTIONS
    // =============================================================

    /**
     * @notice Execute a call from this account
     * @dev Only callable by the NFT owner
     * @param to Target address
     * @param value ETH value to send
     * @param data Calldata
     * @return result Return data from the call
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable override returns (bytes memory result) {
        if (!_isValidSigner(msg.sender)) revert NotAuthorized();

        _state++;

        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        emit Executed(to, value, data, result);
    }

    /**
     * @notice Execute multiple calls in a batch
     * @dev Only callable by the NFT owner. Useful for complex operations.
     * @param operations Array of operations to execute
     * @return results Array of return data from each call
     */
    function executeBatch(
        Operation[] calldata operations
    ) external payable override returns (bytes[] memory results) {
        if (!_isValidSigner(msg.sender)) revert NotAuthorized();

        _state++;

        uint256 length = operations.length;
        results = new bytes[](length);

        for (uint256 i = 0; i < length; ) {
            Operation calldata op = operations[i];

            (bool success, bytes memory result) = op.to.call{value: op.value}(op.data);

            if (!success) {
                revert CallFailed(i, result);
            }

            results[i] = result;

            unchecked {
                ++i;
            }
        }

        emit BatchExecuted(length);
    }

    // =============================================================
    //                       TOKEN INFO
    // =============================================================

    /**
     * @notice Get the NFT this account is bound to
     * @return chainId The chain ID
     * @return tokenContract The NFT contract address
     * @return tokenId The NFT token ID
     */
    function token()
        external
        view
        override
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    /**
     * @notice Get the owner of the bound NFT
     * @return The owner address
     */
    function owner() public view override returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = this.token();

        if (chainId != block.chainid) return address(0);

        return IERC721(tokenContract).ownerOf(tokenId);
    }

    /**
     * @notice Get the current state/nonce
     * @return The current state
     */
    function state() external view override returns (uint256) {
        return _state;
    }

    // =============================================================
    //                    ERC-1271 SIGNATURE VALIDATION
    // =============================================================

    /**
     * @notice Validate a signature (ERC-1271)
     * @dev Returns magic value if the signer is the NFT owner
     * @param hash The hash that was signed
     * @param signature The signature bytes
     * @return magicValue The ERC-1271 magic value if valid
     */
    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4 magicValue) {
        // Recover signer from signature
        address signer = _recoverSigner(hash, signature);

        // Check if signer is valid (owner or approved)
        if (_isValidSigner(signer)) {
            return 0x1626ba7e; // ERC-1271 magic value
        }

        return 0xffffffff;
    }

    // =============================================================
    //                       ERC-165 SUPPORT
    // =============================================================

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC6551Executable).interfaceId ||
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x1626ba7e || // ERC-1271
            interfaceId == 0x150b7a02 || // ERC-721 Receiver
            interfaceId == 0x4e2312e0;   // ERC-1155 Receiver
    }

    // =============================================================
    //                   TOKEN RECEIVER FUNCTIONS
    // =============================================================

    /**
     * @notice Handle ERC-721 token reception
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @notice Handle ERC-1155 single token reception
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /**
     * @notice Handle ERC-1155 batch token reception
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    // =============================================================
    //                     INTERNAL FUNCTIONS
    // =============================================================

    /**
     * @notice Check if an address is authorized to control this account
     * @param signer The address to check
     * @return True if authorized
     */
    function _isValidSigner(address signer) internal view returns (bool) {
        address currentOwner = owner();

        // Direct owner
        if (signer == currentOwner) return true;

        // Check if owner is a contract that has approved the signer
        // This handles cases where a Party contract owns the NFT
        // and needs to execute through its proposal system
        if (currentOwner.code.length > 0) {
            // Check if signer is approved operator for the owner
            (uint256 chainId, address tokenContract, uint256 tokenId) = this.token();
            if (chainId == block.chainid) {
                try IERC721(tokenContract).getApproved(tokenId) returns (address approved) {
                    if (signer == approved) return true;
                } catch {}

                try IERC721(tokenContract).isApprovedForAll(currentOwner, signer) returns (bool isApproved) {
                    if (isApproved) return true;
                } catch {}
            }
        }

        return false;
    }

    /**
     * @notice Recover signer from a signature
     * @param hash The signed hash
     * @param signature The signature
     * @return The recovered signer address
     */
    function _recoverSigner(
        bytes32 hash,
        bytes calldata signature
    ) internal pure returns (address) {
        if (signature.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }

        if (v < 27) v += 27;

        if (v != 27 && v != 28) return address(0);

        return ecrecover(hash, v, r, s);
    }
}

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}
