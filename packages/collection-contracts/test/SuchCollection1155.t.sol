// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection1155} from "../src/SuchCollection1155.sol";
import {SuchCollection1155Factory} from "../src/SuchCollection1155Factory.sol";

contract SuchCollection1155Test is Test {
    SuchCollection1155 public collection;
    SuchCollection1155Factory public factory;

    address public platformOwner = address(0x1);
    address public owner = address(0x2);
    address public alice = address(0x3);
    address public bob = address(0x4);
    address payable public royaltyReceiver = payable(address(0x5));

    function setUp() public {
        factory = new SuchCollection1155Factory(platformOwner);
        vm.prank(owner);
        address addr = factory.createCollection("Multi", "MULTI", royaltyReceiver, 1000);
        collection = SuchCollection1155(addr);
    }

    function test_factory_createCollection() public view {
        assertEq(factory.collectionCount(), 1);
        assertEq(factory.collectionOwner(address(collection)), owner);
        assertEq(collection.name(), "Multi");
        assertEq(collection.symbol(), "MULTI");
        assertEq(collection.owner(), owner);
    }

    function test_mint_limited_supply() public {
        vm.prank(owner);
        uint256 tokenId = collection.mint(alice, 10, 100, "ar://meta1");

        assertEq(tokenId, 1);
        assertEq(collection.balanceOf(alice, 1), 10);
        assertEq(collection.maxSupply(1), 100);
        assertEq(collection.totalMinted(1), 10);
        assertEq(collection.uri(1), "ar://meta1");
        assertEq(collection.totalSupply(), 1);
    }

    function test_mint_open_edition() public {
        vm.prank(owner);
        uint256 tokenId = collection.mint(alice, 1, 0, "ar://open");

        assertEq(tokenId, 1);
        assertEq(collection.maxSupply(1), 0);

        vm.prank(owner);
        collection.mintExisting(bob, 1, 500);
        assertEq(collection.totalMinted(1), 501);
        assertEq(collection.balanceOf(bob, 1), 500);
    }

    function test_mint_respects_cap() public {
        vm.prank(owner);
        collection.mint(alice, 5, 5, "ar://capped");

        vm.prank(owner);
        vm.expectRevert("Exceeds max supply");
        collection.mintExisting(alice, 1, 1);
    }

    function test_mint_emits_Minted() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit SuchCollection1155.Minted(alice, 1, "ar://meta");
        collection.mint(alice, 1, 0, "ar://meta");
    }

    function test_royaltyInfo() public view {
        (address receiver, uint256 amount) = collection.royaltyInfo(1, 1 ether);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 0.1 ether);
    }

    function test_getRoyalties() public view {
        (address payable[] memory receivers, uint256[] memory bps) = collection.getRoyalties(0);
        assertEq(receivers.length, 1);
        assertEq(receivers[0], royaltyReceiver);
        assertEq(bps[0], 1000);
    }

    function test_only_owner_can_mint() public {
        vm.prank(alice);
        vm.expectRevert();
        collection.mint(alice, 1, 0, "ar://x");
    }
}
