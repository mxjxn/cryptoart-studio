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
        vm.prank(owner);
        collection721.setTokenURIForLazyMint(tokenId, tokenURI);
        
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
        vm.prank(unauthorizedMarketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection721.deliver(1, alice, 1, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_reverts_invalid_count() public {
        vm.prank(marketplace);
        vm.expectRevert("ERC721 can only deliver 1 token");
        collection721.deliver(1, alice, 1, 2, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_reverts_token_already_minted() public {
        uint256 tokenId = 1;
        
        // Mint token first
        vm.prank(owner);
        collection721.mint(bob, "ipfs://already-minted");
        
        // Try to lazy deliver same token
        vm.prank(marketplace);
        vm.expectRevert("Token already minted");
        collection721.deliver(1, alice, tokenId, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_reverts_zero_address() public {
        vm.prank(marketplace);
        vm.expectRevert("Cannot deliver to zero address");
        collection721.deliver(1, address(0), 1, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_multiple_listings() public {
        // Deliver multiple tokens from different listings
        for (uint40 listingId = 1; listingId <= 5; listingId++) {
            uint256 tokenId = listingId;
            vm.prank(owner);
            collection721.setTokenURIForLazyMint(tokenId, string(abi.encodePacked("ipfs://lazy", vm.toString(tokenId))));
            
            vm.prank(marketplace);
            collection721.deliver(listingId, alice, tokenId, 1, 1 ether, address(0), 0);
        }
        
        assertEq(collection721.balanceOf(alice), 5);
        assertEq(collection721.totalSupply(), 5);
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
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://edition1", 100);
        
        // Deliver to buyer
        vm.prank(marketplace);
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
        
        assertEq(collection1155.balanceOf(alice, tokenId), 10);
        assertEq(collection1155.totalMinted(tokenId), 10);
    }

    function test_erc1155_lazyDeliver_multiple_deliveries() public {
        // Prepare lazy token
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://edition2", 100);
        
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
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://limited", 50);
        
        // Try to deliver more than max supply
        vm.prank(marketplace);
        vm.expectRevert("Exceeds max supply");
        collection1155.deliver(1, alice, tokenId, 51, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_no_uri() public {
        uint256 tokenId = 999; // Non-existent token without prepared URI
        
        vm.prank(marketplace);
        vm.expectRevert("Token URI not set");
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_unlimited_supply() public {
        // Prepare lazy token with unlimited supply
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://unlimited", 0);
        
        // Deliver large amount (should not revert)
        vm.prank(marketplace);
        collection1155.deliver(1, alice, tokenId, 1000, 10 ether, address(0), 0);
        
        assertEq(collection1155.balanceOf(alice, tokenId), 1000);
        assertEq(collection1155.totalMinted(tokenId), 1000);
    }

    function test_erc1155_lazyDeliver_reverts_unauthorized() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        
        vm.prank(unauthorizedMarketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection1155.deliver(1, alice, tokenId, 10, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_zero_count() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        
        vm.prank(marketplace);
        vm.expectRevert("Amount must be > 0");
        collection1155.deliver(1, alice, tokenId, 0, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_zero_address() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);
        
        vm.prank(marketplace);
        vm.expectRevert("Cannot deliver to zero address");
        collection1155.deliver(1, address(0), tokenId, 10, 1 ether, address(0), 0);
    }

    // === Integration Tests ===

    function test_erc721_and_erc1155_can_use_same_marketplace() public {
        // ERC721 delivery
        vm.prank(owner);
        collection721.setTokenURIForLazyMint(1, "ipfs://721-token");
        
        vm.prank(marketplace);
        collection721.deliver(1, alice, 1, 1, 1 ether, address(0), 0);
        
        // ERC1155 delivery
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://1155-token", 100);
        
        vm.prank(marketplace);
        collection1155.deliver(2, bob, tokenId, 10, 1 ether, address(0), 0);
        
        // Verify both worked
        assertEq(collection721.ownerOf(1), alice);
        assertEq(collection1155.balanceOf(bob, tokenId), 10);
    }

    function test_marketplace_can_be_revoked() public {
        // Revoke marketplace approval
        vm.prank(owner);
        collection721.setMarketplaceApproval(marketplace, false);
        
        assertFalse(collection721.isMarketplaceApproved(marketplace));
        
        // Try to deliver after revocation
        vm.prank(marketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection721.deliver(1, alice, 1, 1, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_respects_supply_across_deliveries() public {
        // Prepare token with max supply of 100
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://limited-edition", 100);
        
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
}
