// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/**
 * @title GalleryAccount
 * @notice Custom ERC-6551 token bound account for SuchGallery NFTs.
 *         Implements ERC-721 and ERC-1155 receiver hooks that auto-register
 *         deposits with the parent SuchGallery contract.
 *
 *         When art is safeTransferFrom'd into this TBA, the onERC721Received
 *         hook fires and calls SuchGallery.autoRegisterDeposit(), eliminating
 *         the manual registerDeposit() step.
 *
 *         ERC-20 has no receive hook — those still require manual registration
 *         or indexer detection.
 *
 *         The TBA reads its parent NFT context (tokenContract, tokenId) from
 *         its own bytecode footer via the ERC-6551 proxy pattern — no storage
 *         needed for identity.
 */
contract GalleryAccount is IERC165, IERC1271, IERC721Receiver, IERC1155Receiver {
    uint256 public state;

    receive() external payable {}

    // ─── ERC-6551 Core ──────────────────────────────────────────

    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        virtual
        returns (bytes memory result)
    {
        require(_isValidSigner(msg.sender), "Invalid signer");
        require(operation == 0, "Unsupported operation");

        ++state;

        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function isValidSigner(address signer, bytes calldata) external view virtual returns (bytes4) {
        if (_isValidSigner(signer)) {
            return bytes4(0x523e3260); // IERC6551Account.isValidSigner selector
        }
        return bytes4(0);
    }

    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        virtual
        returns (bytes4)
    {
        bool isValid = SignatureChecker.isValidSignatureNow(owner(), hash, signature);
        return isValid ? IERC1271.isValidSignature.selector : bytes4(0);
    }

    // ─── ERC-721 Receiver Hook ──────────────────────────────────

    /**
     * @notice Auto-registers ERC-721 deposits with the parent SuchGallery.
     *         Fires when someone uses safeTransferFrom to send an NFT here.
     *         Bare transferFrom bypasses this hook — those still need
     *         manual registration.
     *
     *         Uses try/catch so the transfer still succeeds even if the
     *         gallery callback reverts (e.g. during testing with mock
     *         registry, or if gallery contract is not yet deployed).
     */
    function onERC721Received(
        address,
        address,
        uint256 receivedTokenId,
        bytes calldata
    ) external returns (bytes4) {
        (uint256 chainId, address tokenContract, uint256 galleryTokenId) = token();

        if (chainId == block.chainid && tokenContract != msg.sender) {
            // Best-effort registration — don't revert the transfer if this fails
            try IGalleryGallery(tokenContract).autoRegisterDeposit{
                gas: 100_000
            }(galleryTokenId, msg.sender, receivedTokenId) {} catch {}
        }

        return this.onERC721Received.selector;
    }

    // ─── ERC-1155 Receiver Hooks ────────────────────────────────

    function onERC1155Received(
        address,
        address,
        uint256 receivedTokenId,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        (uint256 chainId, address tokenContract, uint256 galleryTokenId) = token();

        if (chainId == block.chainid && tokenContract != msg.sender) {
            try IGalleryGallery(tokenContract).autoRegisterDeposit{
                gas: 150_000
            }(galleryTokenId, msg.sender, receivedTokenId) {} catch {}
        }

        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata receivedTokenIds,
        uint256[] calldata,
        bytes calldata
    ) external returns (bytes4) {
        (uint256 chainId, address tokenContract, uint256 galleryTokenId) = token();

        if (chainId == block.chainid && tokenContract != msg.sender) {
            for (uint256 i = 0; i < receivedTokenIds.length; i++) {
                try IGalleryGallery(tokenContract).autoRegisterDeposit{
                    gas: 150_000
                }(galleryTokenId, msg.sender, receivedTokenIds[i]) {} catch {}
            }
        }

        return this.onERC1155BatchReceived.selector;
    }

    // ─── ERC-165 ────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) public pure virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC721Receiver).interfaceId
            || interfaceId == type(IERC1155Receiver).interfaceId
            || interfaceId == 0x6faff5f1   // IERC6551Account
            || interfaceId == 0x51945447;  // IERC6551Executable
    }

    // ─── Internal ───────────────────────────────────────────────

    /**
     * @notice Reads the parent NFT context from the ERC-6551 proxy bytecode footer.
     *         In production, the registry deploys an EIP-1167 minimal proxy with
     *         (chainId, tokenContract, tokenId) appended — this reads it.
     *         Marked virtual so tests can override with mock context.
     */
    function token() public view virtual returns (uint256, address, uint256) {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function owner() public view virtual returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    function _isValidSigner(address signer) internal view virtual returns (bool) {
        return signer == owner();
    }
}

/**
 * @notice Minimal interface for the auto-register callback to SuchGallery.
 *         Only exposes the function the TBA needs to call.
 */
interface IGalleryGallery {
    function autoRegisterDeposit(
        uint256 galleryTokenId,
        address collection,
        uint256 artTokenId
    ) external;
}
