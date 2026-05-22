// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";

contract SuchCollectionTest is Test {
    SuchCollection public collection;
    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address payable public royaltyReceiver = payable(address(0x4));

    function setUp() public {
        collection = new SuchCollection("Test Collection", "TEST", owner, royaltyReceiver, 500);
    }

    function test_constructor() public view {
        assertEq(collection.name(), "Test Collection");
        assertEq(collection.symbol(), "TEST");
        assertEq(collection.owner(), owner);
        assertEq(collection.totalSupply(), 0);
    }

    function test_mint() public {
        vm.prank(owner);
        uint256 tokenId = collection.mint(alice, "ipfs://token1");

        assertEq(tokenId, 1);
        assertEq(collection.ownerOf(1), alice);
        assertEq(collection.totalSupply(), 1);
        assertEq(collection.balanceOf(alice), 1);
    }

    function test_mint_emits_event() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit SuchCollection.Minted(alice, 1, "ipfs://token1");
        collection.mint(alice, "ipfs://token1");
    }

    function test_mint_reverts_non_owner() public {
        vm.prank(alice);
        vm.expectRevert("Only owner");
        collection.mint(alice, "ipfs://token1");
    }

    function test_mintBatch() public {
        string[] memory uris = new string[](3);
        uris[0] = "ipfs://token1";
        uris[1] = "ipfs://token2";
        uris[2] = "ipfs://token3";

        vm.prank(owner);
        uint256[] memory tokenIds = collection.mintBatch(alice, uris);

        assertEq(tokenIds.length, 3);
        assertEq(tokenIds[0], 1);
        assertEq(tokenIds[1], 2);
        assertEq(tokenIds[2], 3);
        assertEq(collection.totalSupply(), 3);
        assertEq(collection.balanceOf(alice), 3);
    }

    function test_mint_sequential_ids() public {
        vm.startPrank(owner);
        uint256 id1 = collection.mint(alice, "ipfs://1");
        uint256 id2 = collection.mint(alice, "ipfs://2");
        uint256 id3 = collection.mint(bob, "ipfs://3");
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function test_transfer() public {
        vm.prank(owner);
        collection.mint(alice, "ipfs://token1");

        vm.prank(alice);
        collection.transferFrom(alice, bob, 1);

        assertEq(collection.ownerOf(1), bob);
        assertEq(collection.balanceOf(alice), 0);
        assertEq(collection.balanceOf(bob), 1);
    }

    function test_burn() public {
        vm.prank(owner);
        collection.mint(alice, "ipfs://token1");

        vm.prank(alice);
        collection.burn(1);

        assertEq(collection.totalSupply(), 0);
        assertEq(collection.balanceOf(alice), 0);
        vm.expectRevert();
        collection.ownerOf(1);
    }

    function test_burn_reverts_non_owner() public {
        vm.prank(owner);
        collection.mint(alice, "ipfs://token1");

        vm.prank(bob);
        vm.expectRevert("Caller is not owner or approved");
        collection.burn(1);
    }

    function test_tokenURI() public {
        vm.prank(owner);
        collection.mint(alice, "ipfs://token1");

        assertEq(collection.tokenURI(1), "ipfs://token1");
    }

    function test_setTokenURI() public {
        vm.prank(owner);
        collection.mint(alice, "ipfs://token1");

        vm.prank(owner);
        collection.setTokenURI(1, "ipfs://updated");

        assertEq(collection.tokenURI(1), "ipfs://updated");
    }

    function test_setBaseURI() public {
        vm.prank(owner);
        collection.mint(alice, "");

        vm.prank(owner);
        collection.setBaseURI("https://example.com/metadata/");

        assertEq(collection.tokenURI(1), "https://example.com/metadata/1");
    }

    function test_enumerable() public {
        vm.startPrank(owner);
        collection.mint(alice, "ipfs://1");
        collection.mint(bob, "ipfs://2");
        collection.mint(alice, "ipfs://3");
        vm.stopPrank();

        assertEq(collection.totalSupply(), 3);
        assertEq(collection.tokenByIndex(0), 1);
        assertEq(collection.tokenByIndex(1), 2);
        assertEq(collection.tokenByIndex(2), 3);

        assertEq(collection.tokenOfOwnerByIndex(alice, 0), 1);
        assertEq(collection.tokenOfOwnerByIndex(alice, 1), 3);
        assertEq(collection.tokenOfOwnerByIndex(bob, 0), 2);
    }

    function test_royaltyInfo() public view {
        (address receiver, uint256 amount) = collection.royaltyInfo(1, 1 ether);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 0.05 ether);
    }

    function test_setRoyalty() public {
        address payable newReceiver = payable(address(0x5));
        vm.prank(owner);
        collection.setRoyalty(newReceiver, 1000);

        vm.prank(owner);
        collection.mint(alice, "ipfs://1");

        (address receiver, uint256 amount) = collection.royaltyInfo(1, 1 ether);
        assertEq(receiver, newReceiver);
        assertEq(amount, 0.1 ether);
    }

    function test_setRoyalty_reverts_too_high() public {
        vm.prank(owner);
        vm.expectRevert("Royalty too high");
        collection.setRoyalty(royaltyReceiver, 5001);
    }

    function test_registerExtension() public {
        address extension = address(new MockExtension());

        vm.prank(owner);
        collection.registerExtension(extension, "https://ext.example.com/");

        address[] memory extensions = collection.getExtensions();
        assertEq(extensions.length, 1);
        assertEq(extensions[0], extension);
    }

    function test_unregisterExtension() public {
        address extension = address(new MockExtension());

        vm.startPrank(owner);
        collection.registerExtension(extension, "https://ext.example.com/");
        collection.unregisterExtension(extension);
        vm.stopPrank();

        address[] memory extensions = collection.getExtensions();
        assertEq(extensions.length, 0);
    }

    function test_supportsInterface() public view {
        assertTrue(collection.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(collection.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(collection.supportsInterface(0x5b5e139f)); // ERC721Metadata
        assertTrue(collection.supportsInterface(0x780e9d63)); // ERC721Enumerable
        assertTrue(collection.supportsInterface(0x2a55205a)); // EIP-2981
    }
}

contract MockExtension {
    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }
}
