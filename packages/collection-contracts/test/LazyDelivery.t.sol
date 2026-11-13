// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {SuchCollection1155} from "../src/SuchCollection1155.sol";
import {ILazyDelivery} from "../src/interfaces/ILazyDelivery.sol";
import {MockMarketplace} from "./mocks/MockMarketplace.sol";

/**
 * @title LazyDeliveryTest
 * @notice Tests for lazy minting/delivery on SuchCollection (ERC721) and SuchCollection1155
 */
contract LazyDeliveryTest is Test {
    SuchCollection public collection721;
    SuchCollection1155 public collection1155;
    MockMarketplace public marketplace;
    
    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public attacker = address(0x999);
    address public unauthorizedMarketplace = address(0x5);
    address payable public royaltyReceiver = payable(address(0x6));

    event MarketplaceApproved(address indexed marketplace, bool approved);
    event ListingBaseURIUpdated(address indexed marketplace, uint40 indexed listingId, string baseURI);
    event LazyDelivered(uint40 indexed listingId, address indexed to, uint256 indexed tokenId);
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);

    function setUp() public {
        collection721 = new SuchCollection("Test Collection", "TEST", owner, royaltyReceiver, 500);
        collection1155 = new SuchCollection1155("Test Collection 1155", "TEST1155", owner, royaltyReceiver, 500);
        marketplace = new MockMarketplace();
        
        vm.startPrank(owner);
        collection721.setMarketplaceApproval(address(marketplace), true);
        collection1155.setMarketplaceApproval(address(marketplace), true);
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
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(owner);
        collection721.setListingBaseURI(address(marketplace), listingId, "ipfs://listing1/");

        vm.prank(address(marketplace));
        vm.expectEmit(true, true, true, true);
        emit LazyDelivered(listingId, alice, 1);
        collection721.deliver(listingId, alice, 0, 1, 1 ether, address(0), 0);
        
        assertEq(collection721.ownerOf(1), alice);
        assertEq(collection721.tokenURI(1), "ipfs://listing1/0");
        assertEq(collection721.totalSupply(), 1);
    }

    function test_erc721_lazyDeliver_reverts_unauthorized_marketplace() public {
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(unauthorizedMarketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection721.deliver(listingId, alice, 1, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_reverts_zero_count() public {
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(address(marketplace));
        vm.expectRevert("Amount must be > 0");
        collection721.deliver(listingId, alice, 1, 0, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_reverts_zero_address() public {
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(address(marketplace));
        vm.expectRevert("Cannot deliver to zero address");
        collection721.deliver(listingId, address(0), 1, 1, 1 ether, address(0), 0);
    }

    function test_erc721_lazyDeliver_interleaved_with_regular_mints() public {
        vm.prank(owner);
        collection721.mint(alice, "ipfs://regular1");
        assertEq(collection721.ownerOf(1), alice);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(address(marketplace));
        collection721.deliver(listingId, bob, 0, 1, 1 ether, address(0), 0);
        assertEq(collection721.ownerOf(2), bob);

        vm.prank(owner);
        collection721.mint(alice, "ipfs://regular3");
        assertEq(collection721.ownerOf(3), alice);

        vm.prank(address(marketplace));
        collection721.deliver(listingId, bob, 0, 1, 1 ether, address(0), 0);
        assertEq(collection721.ownerOf(4), bob);

        assertEq(collection721.totalSupply(), 4);
    }

    function test_erc721_lazyDeliver_payableCount_multiple() public {
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(owner);
        collection721.setListingBaseURI(address(marketplace), listingId, "ipfs://multi/");

        // Deliver 3 tokens in one call
        vm.prank(address(marketplace));
        collection721.deliver(listingId, alice, 0, 3, 3 ether, address(0), 0);

        assertEq(collection721.ownerOf(1), alice);
        assertEq(collection721.ownerOf(2), alice);
        assertEq(collection721.ownerOf(3), alice);
        assertEq(collection721.totalSupply(), 3);

        assertEq(collection721.tokenURI(1), "ipfs://multi/0");
        assertEq(collection721.tokenURI(2), "ipfs://multi/1");
        assertEq(collection721.tokenURI(3), "ipfs://multi/2");

        (address mkt, uint40 lid, uint24 idx, bool set) = collection721.lazyListingOrigin(2);
        assertEq(mkt, address(marketplace));
        assertEq(lid, listingId);
        assertEq(idx, 1);
        assertTrue(set);
    }

    function test_erc721_lazyDeliver_multi_sale_from_one_listing() public {
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(owner);
        collection721.setListingBaseURI(address(marketplace), listingId, "ipfs://drop/");

        vm.startPrank(address(marketplace));
        collection721.deliver(listingId, alice, 0, 1, 1 ether, address(0), 0);
        collection721.deliver(listingId, bob, 0, 1, 1 ether, address(0), 0);
        collection721.deliver(listingId, alice, 0, 2, 2 ether, address(0), 0);
        vm.stopPrank();

        assertEq(collection721.tokenURI(1), "ipfs://drop/0");
        assertEq(collection721.tokenURI(2), "ipfs://drop/1");
        assertEq(collection721.tokenURI(3), "ipfs://drop/2");
        assertEq(collection721.tokenURI(4), "ipfs://drop/3");
        assertEq(collection721.ownerOf(2), bob);
        assertEq(collection721.totalSupply(), 4);
    }

    function test_erc721_listing_base_uri_requires_trailing_slash() public {
        vm.prank(owner);
        vm.expectRevert("Base URI must end with /");
        collection721.setListingBaseURI(address(marketplace), 1, "ipfs://no-slash");
    }

    function test_erc721_listing_base_uri_fallback_to_collection() public {
        vm.prank(owner);
        collection721.setBaseURI("ipfs://collection/");

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        // No listing base URI set — falls back to collection base URI + tokenId
        vm.prank(address(marketplace));
        collection721.deliver(listingId, alice, 0, 1, 1 ether, address(0), 0);

        assertEq(collection721.tokenURI(1), "ipfs://collection/1");
    }

    // === CRITICAL: Unauthorized / front-run listing exploit prevention ===

    function test_erc721_attacker_listing_cannot_deliver() public {
        // Attacker creates a lazy listing on the collection (global sequential ID)
        vm.prank(attacker);
        uint40 attackerListingId = marketplace.createLazyListing(address(collection721));

        // Marketplace settles to buyer — must fail: seller is attacker, not owner
        vm.prank(address(marketplace));
        vm.expectRevert("Listing seller is not collection owner");
        collection721.deliver(attackerListingId, alice, 0, 1, 1 ether, address(0), 0);

        assertEq(collection721.totalSupply(), 0);
    }

    function test_erc721_front_run_listing_id_cannot_deliver() public {
        // Simulate former front-run scenario: attacker snipes the next global listing ID
        // before the artist creates theirs. With getListing seller check this fails.

        // Attacker takes the next ID
        vm.prank(attacker);
        uint40 snipedId = marketplace.createLazyListing(address(collection721));
        assertEq(snipedId, 1);

        // Artist then creates their listing (gets ID 2)
        vm.prank(owner);
        uint40 ownerListingId = marketplace.createLazyListing(address(collection721));
        assertEq(ownerListingId, 2);

        // Attacker's sniped listing cannot deliver
        vm.prank(address(marketplace));
        vm.expectRevert("Listing seller is not collection owner");
        collection721.deliver(snipedId, alice, 0, 1, 1 ether, address(0), 0);

        // Owner's listing works
        vm.prank(address(marketplace));
        collection721.deliver(ownerListingId, alice, 0, 1, 1 ether, address(0), 0);
        assertEq(collection721.ownerOf(1), alice);
        assertEq(collection721.totalSupply(), 1);
    }

    function test_erc721_listing_wrong_token_cannot_deliver() public {
        // Listing points at a different collection
        SuchCollection other = new SuchCollection("Other", "OTH", owner, royaltyReceiver, 500);
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(other));

        vm.prank(address(marketplace));
        vm.expectRevert("Listing token is not this collection");
        collection721.deliver(listingId, alice, 0, 1, 1 ether, address(0), 0);
    }

    // === ERC1155 Lazy Delivery Tests ===

    function test_erc1155_supportsILazyDelivery() public view {
        assertTrue(collection1155.supportsInterface(type(ILazyDelivery).interfaceId));
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
        assertEq(collection1155.maxSupply(1), 0);
        assertEq(collection1155.totalMinted(1), 0);
    }

    function test_erc1155_lazyDeliver_new_token() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://edition1", 100);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        collection1155.deliver(listingId, alice, tokenId, 10, 1 ether, address(0), 0);
        
        assertEq(collection1155.balanceOf(alice, tokenId), 10);
        assertEq(collection1155.totalMinted(tokenId), 10);
    }

    function test_erc1155_lazyDeliver_multiple_deliveries() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://edition2", 100);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.startPrank(address(marketplace));
        collection1155.deliver(listingId, alice, tokenId, 10, 1 ether, address(0), 0);
        collection1155.deliver(listingId, bob, tokenId, 20, 2 ether, address(0), 0);
        vm.stopPrank();
        
        assertEq(collection1155.balanceOf(alice, tokenId), 10);
        assertEq(collection1155.balanceOf(bob, tokenId), 20);
        assertEq(collection1155.totalMinted(tokenId), 30);
    }

    function test_erc1155_lazyDeliver_reverts_exceeds_max_supply() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://limited", 50);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        vm.expectRevert("Exceeds max supply");
        collection1155.deliver(listingId, alice, tokenId, 51, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_no_uri() public {
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        vm.expectRevert("Token URI not set");
        collection1155.deliver(listingId, alice, 999, 10, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_unlimited_supply() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://unlimited", 0);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        collection1155.deliver(listingId, alice, tokenId, 1000, 10 ether, address(0), 0);
        
        assertEq(collection1155.balanceOf(alice, tokenId), 1000);
        assertEq(collection1155.totalMinted(tokenId), 1000);
    }

    function test_erc1155_lazyDeliver_reverts_unauthorized() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(unauthorizedMarketplace);
        vm.expectRevert("Caller not approved marketplace");
        collection1155.deliver(listingId, alice, tokenId, 10, 1 ether, address(0), 0);
    }

    function test_erc1155_attacker_listing_cannot_deliver() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);

        vm.prank(attacker);
        uint40 attackerListingId = marketplace.createLazyListing(address(collection1155));

        vm.prank(address(marketplace));
        vm.expectRevert("Listing seller is not collection owner");
        collection1155.deliver(attackerListingId, alice, tokenId, 10, 1 ether, address(0), 0);

        assertEq(collection1155.balanceOf(alice, tokenId), 0);
    }

    function test_erc1155_lazyDeliver_reverts_zero_count() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        vm.expectRevert("Amount must be > 0");
        collection1155.deliver(listingId, alice, tokenId, 0, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_reverts_zero_address() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://test", 100);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        vm.expectRevert("Cannot deliver to zero address");
        collection1155.deliver(listingId, address(0), tokenId, 10, 1 ether, address(0), 0);
    }

    function test_erc721_and_erc1155_can_use_same_marketplace() public {
        vm.prank(owner);
        uint40 listing721 = marketplace.createLazyListing(address(collection721));
        
        vm.prank(address(marketplace));
        collection721.deliver(listing721, alice, 0, 1, 1 ether, address(0), 0);
        
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://1155-token", 100);

        vm.prank(owner);
        uint40 listing1155 = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        collection1155.deliver(listing1155, bob, tokenId, 10, 1 ether, address(0), 0);
        
        assertEq(collection721.ownerOf(1), alice);
        assertEq(collection1155.balanceOf(bob, tokenId), 10);
    }

    function test_marketplace_can_be_revoked() public {
        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection721));

        vm.prank(owner);
        collection721.setMarketplaceApproval(address(marketplace), false);
        
        assertFalse(collection721.isMarketplaceApproved(address(marketplace)));
        
        vm.prank(address(marketplace));
        vm.expectRevert("Caller not approved marketplace");
        collection721.deliver(listingId, alice, 1, 1, 1 ether, address(0), 0);
    }

    function test_erc1155_lazyDeliver_respects_supply_across_deliveries() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.prepareLazyToken("ipfs://limited-edition", 100);

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.startPrank(address(marketplace));
        collection1155.deliver(listingId, alice, tokenId, 30, 1 ether, address(0), 0);
        collection1155.deliver(listingId, bob, tokenId, 40, 1 ether, address(0), 0);
        collection1155.deliver(listingId, alice, tokenId, 30, 1 ether, address(0), 0);
        vm.stopPrank();
        
        assertEq(collection1155.totalMinted(tokenId), 100);
        
        vm.prank(address(marketplace));
        vm.expectRevert("Exceeds max supply");
        collection1155.deliver(listingId, bob, tokenId, 1, 1 ether, address(0), 0);
    }

    function test_erc1155_counter_no_drift() public {
        vm.startPrank(owner);
        uint256 tokenId1 = collection1155.prepareLazyToken("ipfs://token1", 100);
        assertEq(tokenId1, 1);
        assertEq(collection1155.totalSupply(), 1);
        
        uint256 tokenId2 = collection1155.prepareLazyToken("ipfs://token2", 100);
        assertEq(tokenId2, 2);
        assertEq(collection1155.totalSupply(), 2);
        vm.stopPrank();

        vm.prank(owner);
        uint40 listingId = marketplace.createLazyListing(address(collection1155));
        
        vm.prank(address(marketplace));
        collection1155.deliver(listingId, alice, tokenId1, 10, 1 ether, address(0), 0);
        
        assertEq(collection1155.totalSupply(), 2);
        
        vm.prank(owner);
        uint256 tokenId3 = collection1155.prepareLazyToken("ipfs://token3", 100);
        assertEq(tokenId3, 3);
        assertEq(collection1155.totalSupply(), 3);
    }
}
