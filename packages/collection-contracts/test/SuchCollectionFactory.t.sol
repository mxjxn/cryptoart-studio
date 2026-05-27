// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollectionFactory} from "../src/SuchCollectionFactory.sol";
import {SuchCollection} from "../src/SuchCollection.sol";

contract SuchCollectionFactoryTest is Test {
    SuchCollectionFactory public factory;
    address public platformOwner = address(0x1);
    address public artist1 = address(0x2);
    address public artist2 = address(0x3);
    address payable public royaltyReceiver = payable(address(0x4));

    function setUp() public {
        factory = new SuchCollectionFactory(platformOwner);
    }

    function test_constructor() public view {
        assertEq(factory.owner(), platformOwner);
        assertEq(factory.collectionCount(), 0);
    }

    function test_createCollection() public {
        vm.prank(artist1);
        address collectionAddr = factory.createCollection("Art Collection", "ART", royaltyReceiver, 500);

        assertEq(factory.collectionCount(), 1);
        assertEq(factory.collectionOwner(collectionAddr), artist1);

        SuchCollection collection = SuchCollection(collectionAddr);
        assertEq(collection.name(), "Art Collection");
        assertEq(collection.symbol(), "ART");
        assertEq(collection.owner(), artist1);
    }

    function test_createCollection_emits_event() public {
        vm.recordLogs();
        vm.prank(artist1);
        address collectionAddr = factory.createCollection("Art Collection", "ART", royaltyReceiver, 500);

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 3);

        assertEq(entries[2].topics[0], keccak256("CollectionCreated(address,address,string,string)"));
        assertEq(entries[2].topics[1], bytes32(uint256(uint160(collectionAddr))));
        assertEq(entries[2].topics[2], bytes32(uint256(uint160(artist1))));
    }

    function test_createCollection_multiple_artists() public {
        vm.prank(artist1);
        address addr1 = factory.createCollection("Collection 1", "C1", royaltyReceiver, 0);

        vm.prank(artist2);
        address addr2 = factory.createCollection("Collection 2", "C2", royaltyReceiver, 250);

        assertEq(factory.collectionCount(), 2);
        assertEq(factory.collectionOwner(addr1), artist1);
        assertEq(factory.collectionOwner(addr2), artist2);
    }

    function test_getCollectionsByArtist() public {
        vm.startPrank(artist1);
        address addr1 = factory.createCollection("C1", "C1", royaltyReceiver, 0);
        address addr2 = factory.createCollection("C2", "C2", royaltyReceiver, 0);
        vm.stopPrank();

        address[] memory artistCollections = factory.getCollectionsByArtist(artist1);
        assertEq(artistCollections.length, 2);
        assertEq(artistCollections[0], addr1);
        assertEq(artistCollections[1], addr2);
    }

    function test_getAllCollections() public {
        vm.prank(artist1);
        factory.createCollection("C1", "C1", royaltyReceiver, 0);

        vm.prank(artist2);
        factory.createCollection("C2", "C2", royaltyReceiver, 0);

        address[] memory all = factory.getAllCollections();
        assertEq(all.length, 2);
    }

    function test_collection_royalty_config() public {
        vm.prank(artist1);
        address collectionAddr = factory.createCollection("Art", "ART", royaltyReceiver, 750);

        SuchCollection collection = SuchCollection(collectionAddr);
        (address receiver, uint256 amount) = collection.royaltyInfo(1, 1 ether);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 0.075 ether);
    }
}
