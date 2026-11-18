// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {GenerativeParametersExtension} from "../src/extensions/GenerativeParametersExtension.sol";
import {GenerativeDerived} from "../src/extensions/GenerativeDerived.sol";

contract GenerativeParametersExtensionTest is Test {
    SuchCollection public collection;
    GenerativeParametersExtension public extension;
    address public owner = address(0xA11CE);
    address public collector = address(0xB0B);
    address payable public royaltyReceiver = payable(address(0xFEE));

    bytes32 public constant ARTIST_HUE = keccak256("artist.hue");

    function setUp() public {
        collection = new SuchCollection("Generative", "GEN", owner, royaltyReceiver, 250);
        extension = new GenerativeParametersExtension(address(collection), owner);
        vm.prank(owner);
        collection.registerExtension(address(extension), "");
    }

    function test_mint_records_derived_values() public {
        vm.prank(owner);
        uint256 tokenId = extension.mint(collector, "ar://meta", hex"0102");

        assertEq(collection.ownerOf(tokenId), collector);
        assertEq(collection.tokenExtension(tokenId), address(extension));

        assertEq(extension.getDerivedValue(tokenId, GenerativeDerived.TOKEN_ID), bytes32(tokenId));
        assertEq(extension.getDerivedValue(tokenId, GenerativeDerived.MINT_INDEX), bytes32(uint256(1)));
        assertEq(extension.getDerivedValue(tokenId, GenerativeDerived.EXTENSION_MINT_COUNT), bytes32(uint256(1)));
        assertEq(extension.getDerivedValue(tokenId, GenerativeDerived.MINT_BLOCK), bytes32(block.number));
        assertEq(extension.getDerivedValue(tokenId, GenerativeDerived.SEED), extension.seed(tokenId));
        assertGt(uint256(extension.getDerivedValue(tokenId, GenerativeDerived.MINT_TIMESTAMP)), 0);
    }

    function test_params_collection_and_token_override() public {
        vm.startPrank(owner);
        extension.setCollectionParameter(ARTIST_HUE, bytes32(uint256(180)));
        uint256 tokenId = extension.mint(collector, "ar://one", "");
        extension.setTokenParameter(tokenId, ARTIST_HUE, bytes32(uint256(42)));
        vm.stopPrank();

        assertEq(extension.getParameter(tokenId, ARTIST_HUE), bytes32(uint256(42)));

        vm.prank(owner);
        uint256 tokenId2 = extension.mint(collector, "ar://two", "");
        assertEq(extension.getParameter(tokenId2, ARTIST_HUE), bytes32(uint256(180)));
    }

    function test_mint_increments_index() public {
        vm.startPrank(owner);
        uint256 a = extension.mint(collector, "ar://a", "");
        uint256 b = extension.mint(collector, "ar://b", "");
        vm.stopPrank();

        assertEq(extension.getDerivedValue(a, GenerativeDerived.MINT_INDEX), bytes32(uint256(1)));
        assertEq(extension.getDerivedValue(b, GenerativeDerived.MINT_INDEX), bytes32(uint256(2)));
        assertEq(extension.mintRecordCount(), 2);
    }

    function test_seed_deterministic_for_record() public {
        vm.prank(owner);
        uint256 tokenId = extension.mint(collector, "ar://x", "");
        bytes32 s1 = extension.seed(tokenId);
        bytes32 s2 = extension.getDerivedValue(tokenId, GenerativeDerived.SEED);
        assertEq(s1, s2);
    }

    function test_custom_derived_handler() public {
        GenerativeEchoHandler handler = new GenerativeEchoHandler();
        vm.startPrank(owner);
        extension.registerCustomDerived(keccak256("custom.echo"), address(handler));
        uint256 tokenId = extension.mint(collector, "ar://custom", "");
        vm.stopPrank();

        assertEq(extension.getDerivedValue(tokenId, keccak256("custom.echo")), bytes32(tokenId));
    }

    function test_reverts_unknown_derived() public {
        vm.prank(owner);
        uint256 tokenId = extension.mint(collector, "ar://z", "");
        vm.expectRevert(GenerativeParametersExtension.UnknownDerivedKey.selector);
        extension.getDerivedValue(tokenId, keccak256("missing"));
    }

    function test_reverts_set_param_if_not_extension_mint() public {
        vm.prank(owner);
        uint256 other = collection.mint(collector, "ar://direct");
        vm.prank(owner);
        vm.expectRevert(GenerativeParametersExtension.NotTokenMinter.selector);
        extension.setTokenParameter(other, ARTIST_HUE, bytes32(uint256(1)));
    }
}

contract GenerativeEchoHandler {
    function derive(bytes32, uint256 tokenId) external pure returns (bytes32) {
        return bytes32(tokenId);
    }
}