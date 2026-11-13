// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {SuchCollection1155} from "../src/SuchCollection1155.sol";
import {ILazyDelivery} from "../src/interfaces/ILazyDelivery.sol";

/**
 * @title LazyDeliveryTest
 * @notice Comprehensive tests for lazy minting/delivery functionality on SuchCollection (ERC721) and SuchCollection1155
 */
contract LazyDeliveryTest is Test {
    SuchCollection public collection721;
    SuchCollection1155 public collection1155;
    
    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public marketplace = address(0x4);
    address public unauthorizedMarketplace = address(0x5);
    address payable public royaltyReceiver = payable(address(0x6));

    event MarketplaceApproved(address indexed marketplace, bool approved);
    event ListingIdApproved(uint40 indexed listingId, bool approved);
    event LazyDelivered(uint40 indexed listingId, address indexed to, uint256 indexed tokenId);
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);

    function setUp() public {
        // Deploy ERC721 collection
        collection721 = new SuchCollection("Test Collection", "TEST", owner, royaltyReceiver, 500);
        
        // Deploy ERC1155 collection
        collection1155 = new SuchCollection1155("Test Collection 1155", "TEST1155", owner, royaltyReceiver, 500);
        
        // Approve marketplace for both collections
        vm.startPrank(owner);
        collection721.setMarketplaceApproval(marketplace, true);
        collection1155.setMarketplaceApproval(marketplace, true);
        vm.stopPrank();
    }

    // === ERC721 Lazy Delivery Tests ===

    function test_erc721_supportsILazyDelivery() public view {
        assertTrue(collection721.supportsInterface(type(ILazyDelivery).interfaceId));
    }

    function test_erc721_setMarketplaceApproval() public {
        address newMarketplace = address(0x99);
        
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit MarketplaceApproved(newMarketplace, true);
        collection721.setMarketplaceApproval(newMarketplace, true);
        
        assertTrue(collection721.isMarketplaceApproved(newMarketplace));
    }

    function test_erc721_setMarketplaceApproval_reverts_non_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        collection721.setMarketplaceApproval(address(0x99), true);
    }

    function test_erc721_setMarketplaceApproval_reverts_zero_address() public {
        vm.prank(owner);
        vm.expectRevert("Invalid marketplace");
        collection721.setMarketplaceApproval(address(0), true);
    }

    function test_erc721_lazyDeliver_success() public {
        uint40 listingId = 1;
        uint256 tokenId = 1;
        string memory tokenURI = "ipfs://lazy1";
        
        // Preset the token URI (would be done by artist when creating lazy listing)
        vm.startPrank(owner);
        collection721.setTokenURIForLazyMint(tokenId, tokenURI);
        
        // IMPORTANT: Owner must approve listing ID before it can be delivered
        collection721.setListingIdApproval(listingId, true);
        vm.stopPrank();
        
        // Marketplace delivers to buyer
        vm.prank(marketplace);
        vm.expectEmit(true, true, true, true);
        emit LazyDelivered(listingId, alice, tokenId);
        collection721.deliver(listingId, alice, tokenId, 1, 1 ether, address(0), 0);
        
        // Verify token was minted
        assertEq(collection721.ownerOf(tokenId), alice);
        assertEq(collection721.tokenURI(tokenId), tokenURI);
        assertEq(collection721.totalSupply(), 1);
    }

    function test_erc721_lazyDeliver_reverts_unauthorized_marketplace() public {
        vm.prank(owner);
        collection721.setListingIdApproval(1, true);
        
        vm.prank(unauthorizedMarketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection721.deliver(1, alice, 1, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_reverts_unapproved_listing() public {
        uint40 listingId = 999;
        uint256 tokenId = 1;
        
        vm.prank(owner);
        collection721.setTokenURIForLazyMint(tokenId, "ipfs://test");
        
        // Try to deliver without approving listing ID
        vm.prank(marketplace);
        vm.expectRevert("Listing ID not approved");
        collection721.deliver(listingId, alice, tokenId, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_exploit_prevented() public {
        // EXPLOIT SCENARIO:
        // Attacker tries to create a lazy listing on collection they don't own
        // and collect payment when someone buys it
        
        uint40 attackerListingId = 666;
        uint256 tokenId = 1;
        address attacker = address(0x999);
        
        // Attacker creates listing on marketplace (not shown - would call marketplace directly)
        // Marketplace approves the listing because attacker has permission to create listings
        
        // Attacker can't approve the listing ID on the collection (only owner can)
        vm.prank(attacker);
        vm.expectRevert();
        collection721.setListingIdApproval(attackerListingId, true);
        
        // When buyer purchases, delivery fails because listing ID not approved
        vm.prank(marketplace);
        vm.expectRevert("Listing ID not approved");
        collection721.deliver(attackerListingId, alice, tokenId, 1, 1 ether, address(0), 0);
        
        // Token was NOT minted - attacker exploit prevented
        assertEq(collection721.totalSupply(), 0);
    }

    function test_erc721_lazyDeliver_reverts_invalid_count() public {
        vm.prank(owner);
        collection721.setListingIdApproval(1, true);
        
        vm.prank(marketplace);
        vm.expectRevert("ERC721 can only deliver 1 token");
        collection721.deliver(1, alice, 1, 2, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_reverts_token_already_minted() public {
        uint256 tokenId = 1;
        
        // Mint token first
        vm.startPrank(owner);
        collection721.mint(bob, "ipfs://already-minted");
        collection721.setListingIdApproval(1, true);
        vm.stopPrank();
        
        // Lazy deliver will mint token 2 (next sequential), not token 1
        // So this test is no longer relevant with sequential minting
        // But we can test that it successfully mints the next token
        vm.prank(marketplace);
        collection721.deliver(1, alice, 0, 1, 1 ether, address(0), 0);
        
        // Should have minted token 2, not collided with token 1
        assertEq(collection721.ownerOf(1), bob);
        assertEq(collection721.ownerOf(2), alice);
    }

    function test_erc721_lazyDeliver_reverts_zero_address() public {
        vm.prank(owner);
        collection721.setListingIdApproval(1, true);
        
        vm.prank(marketplace);
        vm.expectRevert("Cannot deliver to zero address");
        collection721.deliver(1, address(0), 1, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_multiple_listings() public {
        // Prepare listing IDs for batch approval
        uint40[] memory listingIds = new uint40[](5);
        for (uint40 i = 0; i < 5; i++) {
            listingIds[i] = i + 1;
        }
        
        vm.startPrank(owner);
        // Batch approve all listing IDs
        collection721.setListingIdApprovalBatch(listingIds);
        
        // Deliver multiple tokens from different listings
        for (uint40 listingId = 1; listingId <= 5; listingId++) {
            uint256 tokenId = listingId;
            collection721.setTokenURIForLazyMint(tokenId, string(abi.encodePacked("ipfs://lazy", vm.toString(tokenId))));
        }
        vm.stopPrank();
        
        for (uint40 listingId = 1; listingId <= 5; listingId++) {
            uint256 tokenId = listingId;
            vm.prank(marketplace);
            collection721.deliver(listingId, alice, tokenId, 1, 1 ether, address(0), 0);
        }
        
        assertEq(collection721.balanceOf(alice), 5);
        assertEq(collection721.totalSupply(), 5);
    }

    function test_erc721_setListingIdApproval() public {
        uint40 listingId = 42;
        
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit ListingIdApproved(listingId, true);
        collection721.setListingIdApproval(listingId, true);
        
        assertTrue(collection721.isListingIdApproved(listingId));
        
        // Revoke approval
        vm.prank(owner);
        collection721.setListingIdApproval(listingId, false);
        assertFalse(collection721.isListingIdApproved(listingId));
    }

    function test_erc721_setListingIdApprovalBatch() public {
        uint40[] memory listingIds = new uint40[](3);
        listingIds[0] = 1;
        listingIds[1] = 2;
        listingIds[2] = 3;
        
        vm.prank(owner);
        collection721.setListingIdApprovalBatch(listingIds);
        
        assertTrue(collection721.isListingIdApproved(1));
        assertTrue(collection721.isListingIdApproved(2));
        assertTrue(collection721.isListingIdApproved(3));
    }

    // === ERC1155 Lazy Delivery Tests ===

    function test_erc1155_supportsILazyDelivery() public view {
        assertTrue(collection1155.supportsInterface(type(ILazyDelivery).interfaceId));
    }

    function test_erc1155_setMarketplaceApproval() public {
        address newMarketplace = address(0x99);
        
        vm.prank(owner);
        collection1155.setMarketplaceApproval(newMarketplace, true);
        
        assertTrue(collection1155.isMarketplaceApproved(newMarketplace));
    }

    function test_erc1155_prepareLazyToken() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://lazy-edition", 100);
        
        assertEq(tokenId, 1);
        assertEq(collection1155.maxSupply(1), 100);
        assertEq(collection1155.totalMinted(1), 0);
        assertEq(collection1155.uri(1), "ipfs://lazy-edition");
    }

    function test_erc1155_prepareLazyToken_unlimited_supply() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://unlimited", 0);
        
        assertEq(tokenId, 1);
        assertEq(collection1155.maxSupply(1), 0); // 0 means unlimited
        assertEq(collection1155.totalMinted(1), 0);
    }

    function test_erc1155_lazyDeliver_new_token() public {
        // Prepare lazy token
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://edition1", 100);
        
        // Approve listing ID
        collection1155.setListingIdApproval(1, true);
        vm.stopPrank();
        
        // Deliver to buyer
        vm.prank(marketplace);
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
        
        assertEq(collection1155.balanceOf(alice, tokenId), 10);
        assertEq(collection1155.totalMinted(tokenId), 10);
    }

    function test_erc1155_lazyDeliver_multiple_deliveries() public {
        // Prepare lazy token
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://edition2", 100);
        
        // Approve both listing IDs
        collection1155.setListingIdApproval(1, true);
        collection1155.setListingIdApproval(2, true);
        vm.stopPrank();
        
        // Multiple deliveries to different buyers
        vm.startPrank(marketplace);
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
        collection1155.deliver(2, bob, tokenId, 20, 2 ether, address(0), 0);
        vm.stopPrank();
        
        assertEq(collection1155.balanceOf(alice, tokenId), 10);
        assertEq(collection1155.balanceOf(bob, tokenId), 20);
        assertEq(collection1155.totalMinted(tokenId), 30);
    }

    function test_erc1155_lazyDeliver_reverts_exceeds_max_supply() public {
        // Prepare lazy token with limited supply
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://limited", 50);
        collection1155.setListingIdApproval(1, true);
        vm.stopPrank();
        
        // Try to deliver more than max supply
        vm.prank(marketplace);
        vm.expectRevert("Exceeds max supply");
        collection1155.deliver(1, alice, tokenId, 51, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_no_uri() public {
        uint256 tokenId = 999; // Non-existent token without prepared URI
        
        vm.prank(owner);
        collection1155.setListingIdApproval(1, true);
        
        vm.prank(marketplace);
        vm.expectRevert("Token URI not set");
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_unlimited_supply() public {
        // Prepare lazy token with unlimited supply
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://unlimited", 0);
        collection1155.setListingIdApproval(1, true);
        vm.stopPrank();
        
        // Deliver large amount (should not revert)
        vm.prank(marketplace);
        collection1155.deliver(1, alice, tokenId, 1000, 10 ether, address(0), 0);
        
        assertEq(collection1155.balanceOf(alice, tokenId), 1000);
        assertEq(collection1155.totalMinted(tokenId), 1000);
    }

    function test_erc1155_lazyDeliver_reverts_unauthorized() public {
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        collection1155.setListingIdApproval(1, true);
        vm.stopPrank();
        
        vm.prank(unauthorizedMarketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_unapproved_listing() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        
        // Try to deliver without approving listing ID
        vm.prank(marketplace);
        vm.expectRevert("Listing ID not approved");
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_exploit_prevented() public {
        // EXPLOIT SCENARIO: Same as 721 but for 1155
        uint40 attackerListingId = 666;
        address attacker = address(0x999);
        
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        vm.stopPrank();
        
        // Attacker can't approve the listing ID
        vm.prank(attacker);
        vm.expectRevert();
        collection1155.setListingIdApproval(attackerListingId, true);
        
        // Delivery fails
        vm.prank(marketplace);
        vm.expectRevert("Listing ID not approved");
        collection1155.deliver(attackerListingId, alice, tokenId, 10, 1 ether, address(0), 0);
        
        // No tokens minted
        assertEq(collection1155.balanceOf(alice, tokenId), 0);
    }

    function test_erc1155_lazyDeliver_reverts_zero_count() public {
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        collection1155.setListingIdApproval(1, true);
        vm.stopPrank();
        
        vm.prank(marketplace);
        vm.expectRevert("Amount must be > 0");
        collection1155.deliver(1, alice, tokenId, 0, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_zero_address() public {
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        collection1155.setListingIdApproval(1, true);
        vm.stopPrank();
        
        vm.prank(marketplace);
        vm.expectRevert("Cannot deliver to zero address");
        collection1155.deliver(1, address(0), tokenId, 10, 1 ether, address(0), 0);
    }

    // === Integration Tests ===

    function test_erc721_and_erc1155_can_use_same_marketplace() public {
        // ERC721 delivery
        vm.startPrank(owner);
        collection721.setTokenURIForLazyMint(1, "ipfs://721-token");
        collection721.setListingIdApproval(1, true);
        vm.stopPrank();
        
        vm.prank(marketplace);
        collection721.deliver(1, alice, 1, 1, 1 ether, address(0), 0);
        
        // ERC1155 delivery
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://1155-token", 100);
        collection1155.setListingIdApproval(2, true);
        vm.stopPrank();
        
        vm.prank(marketplace);
        collection1155.deliver(2, bob, tokenId, 10, 1 ether, address(0), 0);
        
        // Verify both worked
        assertEq(collection721.ownerOf(1), alice);
        assertEq(collection1155.balanceOf(bob, tokenId), 10);
    }

    function test_marketplace_can_be_revoked() public {
        vm.startPrank(owner);
        collection721.setListingIdApproval(1, true);
        
        // Revoke marketplace approval
        collection721.setMarketplaceApproval(marketplace, false);
        vm.stopPrank();
        
        assertFalse(collection721.isMarketplaceApproved(marketplace));
        
        // Try to deliver after revocation
        vm.prank(marketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection721.deliver(1, alice, 1, 1, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_respects_supply_across_deliveries() public {
        // Prepare token with max supply of 100
        vm.startPrank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://limited-edition", 100);
        
        // Approve all listing IDs
        collection1155.setListingIdApproval(1, true);
        collection1155.setListingIdApproval(2, true);
        collection1155.setListingIdApproval(3, true);
        collection1155.setListingIdApproval(4, true);
        vm.stopPrank();
        
        // Deliver in multiple batches
        vm.startPrank(marketplace);
        collection1155.deliver(1, alice, tokenId, 30, 1 ether, address(0), 0);
        collection1155.deliver(2, bob, tokenId, 40, 1 ether, address(0), 0);
        collection1155.deliver(3, alice, tokenId, 30, 1 ether, address(0), 0);
        vm.stopPrank();
        
        // Verify total minted equals max supply
        assertEq(collection1155.totalMinted(tokenId), 100);
        
        // Try to deliver one more (should fail)
        vm.prank(marketplace);
        vm.expectRevert("Exceeds max supply");
        collection1155.deliver(4, bob, tokenId, 1, 1 ether, address(0), 0);
    }

    function test_erc1155_counter_no_drift() public {
        // Test that prepareLazyToken and deliver don't both increment the counter
        vm.startPrank(owner);
        uint256 tokenId1 = collection1155.prepareLazyToken("ipfs://token1", 100);
        assertEq(tokenId1, 1);
        assertEq(collection1155.totalSupply(), 1); // Counter should be 1
        
        uint256 tokenId2 = collection1155.prepareLazyToken("ipfs://token2", 100);
        assertEq(tokenId2, 2);
        assertEq(collection1155.totalSupply(), 2); // Counter should be 2
        
        // Approve listings
        collection1155.setListingIdApproval(1, true);
        collection1155.setListingIdApproval(2, true);
        vm.stopPrank();
        
        // Deliver token 1
        vm.prank(marketplace);
        collection1155.deliver(1, alice, tokenId1, 10, 1 ether, address(0), 0);
        
        // Counter should still be 2 (not 3) - no phantom token created
        assertEq(collection1155.totalSupply(), 2);
        
        // Prepare another token after delivery
        vm.prank(owner);
        uint256 tokenId3 = collection1155.prepareLazyToken("ipfs://token3", 100);
        assertEq(tokenId3, 3); // Should be 3, not 4
        assertEq(collection1155.totalSupply(), 3);
    }

    function test_erc721_multi_token_lazy_listing() public {
        // Test selling multiple tokens from one lazy listing
        // The contract picks sequential token IDs automatically
        vm.startPrank(owner);
        collection721.setListingIdApproval(1, true);
        vm.stopPrank();
        
        // Deliver 3 tokens from the same listing to different buyers
        vm.startPrank(marketplace);
        collection721.deliver(1, alice, 0, 1, 1 ether, address(0), 0); // Gets token 1
        collection721.deliver(1, bob, 0, 1, 1 ether, address(0), 0);   // Gets token 2
        collection721.deliver(1, alice, 0, 1, 1 ether, address(0), 0); // Gets token 3
        vm.stopPrank();
        
        assertEq(collection721.ownerOf(1), alice);
        assertEq(collection721.ownerOf(2), bob);
        assertEq(collection721.ownerOf(3), alice);
        assertEq(collection721.totalSupply(), 3);
    }

    function test_erc721_lazy_interleaved_with_regular_mints() public {
        // Test that lazy mints and regular mints don't collide
        vm.startPrank(owner);
        
        // Regular mint token 1
        collection721.mint(alice, "ipfs://regular1");
        assertEq(collection721.ownerOf(1), alice);
        
        // Approve lazy listing
        collection721.setListingIdApproval(1, true);
        vm.stopPrank();
        
        // Lazy deliver token 2
        vm.prank(marketplace);
        collection721.deliver(1, bob, 0, 1, 1 ether, address(0), 0);
        assertEq(collection721.ownerOf(2), bob);
        
        // Regular mint token 3
        vm.prank(owner);
        collection721.mint(alice, "ipfs://regular3");
        assertEq(collection721.ownerOf(3), alice);
        
        // Lazy deliver token 4
        vm.prank(marketplace);
        collection721.deliver(1, bob, 0, 1, 1 ether, address(0), 0);
        assertEq(collection721.ownerOf(4), bob);
        
        assertEq(collection721.totalSupply(), 4);
    }
}
