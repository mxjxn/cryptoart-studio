// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {SuchCollection1155} from "../src/SuchCollection1155.sol";

/**
 * @title BlindMintTest
 * @notice Comprehensive tests for blind minting and reveal functionality
 */
contract BlindMintTest is Test {
    SuchCollection public collection721;
    SuchCollection1155 public collection1155;
    
    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address payable public royaltyReceiver = payable(address(0x6));
    
    string constant PLACEHOLDER = "ipfs://placeholder-mystery-box";
    string constant REVEALED_BASE_URI = "ipfs://revealed-base/";
    bytes32 constant SALT = keccak256("random-salt-123");
    
    event Revealed(string revealedBaseURI, bytes32 metadataHash);

    function setUp() public {
        collection721 = new SuchCollection("Blind Collection", "BLIND", owner, royaltyReceiver, 500);
        collection1155 = new SuchCollection1155("Blind 1155", "BLIND1155", owner, royaltyReceiver, 500);
    }

    // === ERC721 Blind Mint Tests ===

    function test_erc721_setBlindMintConfig() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.prank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        
        assertEq(collection721.placeholderURI(), PLACEHOLDER);
        assertEq(collection721.metadataCommitment(), commitment);
        assertFalse(collection721.isRevealed());
    }

    function test_erc721_setBlindMintConfig_reverts_non_owner() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.prank(alice);
        vm.expectRevert();
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
    }

    function test_erc721_setBlindMintConfig_reverts_empty_placeholder() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.prank(owner);
        vm.expectRevert("Placeholder required");
        collection721.setBlindMintConfig("", commitment);
    }

    function test_erc721_setBlindMintConfig_reverts_zero_hash() public {
        vm.prank(owner);
        vm.expectRevert("Metadata hash required");
        collection721.setBlindMintConfig(PLACEHOLDER, bytes32(0));
    }

    function test_erc721_tokenURI_returns_placeholder_before_reveal() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        uint256 tokenId = collection721.mint(alice, "ipfs://specific-uri");
        vm.stopPrank();
        
        // Should return placeholder, not specific URI
        assertEq(collection721.tokenURI(tokenId), PLACEHOLDER);
    }

    function test_erc721_reveal_success() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        
        vm.expectEmit(true, true, false, true);
        emit Revealed(REVEALED_BASE_URI, commitment);
        collection721.reveal(REVEALED_BASE_URI, SALT);
        vm.stopPrank();
        
        assertTrue(collection721.isRevealed());
    }

    function test_erc721_tokenURI_after_reveal() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        uint256 tokenId = collection721.mint(alice, "");
        
        // Before reveal
        assertEq(collection721.tokenURI(tokenId), PLACEHOLDER);
        
        // Reveal
        collection721.reveal(REVEALED_BASE_URI, SALT);
        
        // After reveal - should use base URI + token ID
        assertEq(collection721.tokenURI(tokenId), string(abi.encodePacked(REVEALED_BASE_URI, "1")));
        vm.stopPrank();
    }

    function test_erc721_reveal_reverts_wrong_hash() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        
        // Try to reveal with wrong data
        vm.expectRevert("Metadata does not match commitment");
        collection721.reveal("ipfs://wrong-uri/", SALT);
        vm.stopPrank();
    }

    function test_erc721_reveal_reverts_wrong_salt() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        
        vm.expectRevert("Metadata does not match commitment");
        collection721.reveal(REVEALED_BASE_URI, keccak256("wrong-salt"));
        vm.stopPrank();
    }

    function test_erc721_reveal_reverts_already_revealed() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        collection721.reveal(REVEALED_BASE_URI, SALT);
        
        vm.expectRevert("Already revealed");
        collection721.reveal(REVEALED_BASE_URI, SALT);
        vm.stopPrank();
    }

    function test_erc721_setBlindMintConfig_reverts_after_reveal() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        collection721.reveal(REVEALED_BASE_URI, SALT);
        
        bytes32 newCommitment = keccak256(abi.encodePacked("new-uri/", SALT));
        vm.expectRevert("Already revealed");
        collection721.setBlindMintConfig("ipfs://new-placeholder", newCommitment);
        vm.stopPrank();
    }

    function test_erc721_reveal_reverts_not_configured() public {
        vm.prank(owner);
        vm.expectRevert("Blind mint not configured");
        collection721.reveal(REVEALED_BASE_URI, SALT);
    }

    function test_erc721_multiple_tokens_same_placeholder() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        
        uint256 token1 = collection721.mint(alice, "uri1");
        uint256 token2 = collection721.mint(bob, "uri2");
        uint256 token3 = collection721.mint(alice, "uri3");
        vm.stopPrank();
        
        // All should return placeholder before reveal
        assertEq(collection721.tokenURI(token1), PLACEHOLDER);
        assertEq(collection721.tokenURI(token2), PLACEHOLDER);
        assertEq(collection721.tokenURI(token3), PLACEHOLDER);
    }

    function test_erc721_multiple_tokens_revealed() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        
        collection721.mint(alice, "");
        collection721.mint(bob, "");
        collection721.mint(alice, "");
        
        collection721.reveal(REVEALED_BASE_URI, SALT);
        vm.stopPrank();
        
        // After reveal, should use base URI + ID
        assertEq(collection721.tokenURI(1), string(abi.encodePacked(REVEALED_BASE_URI, "1")));
        assertEq(collection721.tokenURI(2), string(abi.encodePacked(REVEALED_BASE_URI, "2")));
        assertEq(collection721.tokenURI(3), string(abi.encodePacked(REVEALED_BASE_URI, "3")));
    }

    function test_erc721_normal_mint_without_blind_config() public {
        // Should work normally without blind mint config
        vm.prank(owner);
        uint256 tokenId = collection721.mint(alice, "ipfs://normal-uri");
        
        assertEq(collection721.tokenURI(tokenId), "ipfs://normal-uri");
    }

    // === ERC1155 Blind Mint Tests ===

    function test_erc1155_setBlindMintConfig() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.prank(owner);
        collection1155.setBlindMintConfig(PLACEHOLDER, commitment);
        
        assertEq(collection1155.placeholderURI(), PLACEHOLDER);
        assertEq(collection1155.metadataCommitment(), commitment);
        assertFalse(collection1155.isRevealed());
    }

    function test_erc1155_uri_returns_placeholder_before_reveal() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection1155.setBlindMintConfig(PLACEHOLDER, commitment);
        uint256 tokenId = collection1155.mint(alice, 100, 1000, "ipfs://specific-uri");
        vm.stopPrank();
        
        assertEq(collection1155.uri(tokenId), PLACEHOLDER);
    }

    function test_erc1155_reveal_success() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection1155.setBlindMintConfig(PLACEHOLDER, commitment);
        
        vm.expectEmit(true, true, false, true);
        emit Revealed(REVEALED_BASE_URI, commitment);
        collection1155.reveal(REVEALED_BASE_URI, SALT);
        vm.stopPrank();
        
        assertTrue(collection1155.isRevealed());
    }

    function test_erc1155_uri_after_reveal_with_explicit_uri() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection1155.setBlindMintConfig(PLACEHOLDER, commitment);
        uint256 tokenId = collection1155.mint(alice, 100, 1000, "ipfs://explicit");
        
        assertEq(collection1155.uri(tokenId), PLACEHOLDER);
        
        collection1155.reveal(REVEALED_BASE_URI, SALT);
        
        // After reveal, should use explicit URI
        assertEq(collection1155.uri(tokenId), "ipfs://explicit");
        vm.stopPrank();
    }

    function test_erc1155_uri_after_reveal_with_base_uri() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection1155.setBlindMintConfig(PLACEHOLDER, commitment);
        
        // Mint with explicit URI first to create token
        uint256 tokenId = collection1155.mint(alice, 100, 1000, "temp");
        // Clear the explicit URI
        collection1155.setTokenURI(tokenId, "");
        
        collection1155.reveal(REVEALED_BASE_URI, SALT);
        vm.stopPrank();
        
        // Should use base URI + token ID
        assertEq(collection1155.uri(tokenId), string(abi.encodePacked(REVEALED_BASE_URI, "1")));
    }

    function test_erc1155_reveal_reverts_wrong_commitment() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection1155.setBlindMintConfig(PLACEHOLDER, commitment);
        
        vm.expectRevert("Metadata does not match commitment");
        collection1155.reveal("ipfs://wrong/", SALT);
        vm.stopPrank();
    }

    function test_erc1155_multiple_tokens_same_placeholder() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        vm.startPrank(owner);
        collection1155.setBlindMintConfig(PLACEHOLDER, commitment);
        
        uint256 token1 = collection1155.mint(alice, 100, 0, "uri1");
        uint256 token2 = collection1155.mint(bob, 50, 0, "uri2");
        vm.stopPrank();
        
        // All should return placeholder
        assertEq(collection1155.uri(token1), PLACEHOLDER);
        assertEq(collection1155.uri(token2), PLACEHOLDER);
    }

    // === Integration Tests ===

    function test_blind_mint_with_lazy_delivery() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        address marketplace = address(0x99);
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        collection721.setMarketplaceApproval(marketplace, true);
        collection721.setTokenURIForLazyMint(1, "ipfs://lazy-metadata");
        vm.stopPrank();
        
        // Lazy deliver
        vm.prank(marketplace);
        collection721.deliver(1, alice, 1, 1, 1 ether, address(0), 0);
        
        // Should return placeholder
        assertEq(collection721.tokenURI(1), PLACEHOLDER);
        
        // Reveal
        vm.prank(owner);
        collection721.reveal(REVEALED_BASE_URI, SALT);
        
        // Now should use preset URI
        assertEq(collection721.tokenURI(1), "ipfs://lazy-metadata");
    }

    function test_blind_mint_with_airdrop() public {
        bytes32 commitment = keccak256(abi.encodePacked(REVEALED_BASE_URI, SALT));
        
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = alice;
        
        string[] memory uris = new string[](3);
        uris[0] = "uri1";
        uris[1] = "uri2";
        uris[2] = "uri3";
        
        vm.startPrank(owner);
        collection721.setBlindMintConfig(PLACEHOLDER, commitment);
        uint256[] memory tokenIds = collection721.airdrop(recipients, uris);
        vm.stopPrank();
        
        // All should return placeholder
        for (uint256 i = 0; i < tokenIds.length; i++) {
            assertEq(collection721.tokenURI(tokenIds[i]), PLACEHOLDER);
        }
        
        // Reveal
        vm.prank(owner);
        collection721.reveal(REVEALED_BASE_URI, SALT);
        
        // Now should use specified URIs
        assertEq(collection721.tokenURI(tokenIds[0]), "uri1");
        assertEq(collection721.tokenURI(tokenIds[1]), "uri2");
        assertEq(collection721.tokenURI(tokenIds[2]), "uri3");
    }
}
