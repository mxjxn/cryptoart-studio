// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {SuchCollection1155} from "../src/SuchCollection1155.sol";

/**
 * @title AirdropTest
 * @notice Comprehensive tests for multi-recipient airdrop functionality
 */
contract AirdropTest is Test {
    SuchCollection public collection721;
    SuchCollection1155 public collection1155;
    
    address public owner = address(0x1);
    address payable public royaltyReceiver = payable(address(0x6));
    
    // Airdrop recipients
    address[] public recipients;
    
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event SupplyMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 maxSupply);

    function setUp() public {
        collection721 = new SuchCollection("Test Collection", "TEST", owner, royaltyReceiver, 500);
        collection1155 = new SuchCollection1155("Test Collection 1155", "TEST1155", owner, royaltyReceiver, 500);
        
        // Setup recipients (10 addresses for testing)
        for (uint160 i = 100; i < 110; i++) {
            recipients.push(address(i));
        }
    }

    // === ERC721 Airdrop Tests ===

    function test_erc721_airdrop_basic() public {
        string[] memory uris = new string[](3);
        uris[0] = "ipfs://token1";
        uris[1] = "ipfs://token2";
        uris[2] = "ipfs://token3";
        
        address[] memory threeRecipients = new address[](3);
        threeRecipients[0] = recipients[0];
        threeRecipients[1] = recipients[1];
        threeRecipients[2] = recipients[2];
        
        vm.prank(owner);
        uint256[] memory tokenIds = collection721.airdrop(threeRecipients, uris);
        
        // Verify token IDs
        assertEq(tokenIds.length, 3);
        assertEq(tokenIds[0], 1);
        assertEq(tokenIds[1], 2);
        assertEq(tokenIds[2], 3);
        
        // Verify ownership
        assertEq(collection721.ownerOf(1), recipients[0]);
        assertEq(collection721.ownerOf(2), recipients[1]);
        assertEq(collection721.ownerOf(3), recipients[2]);
        
        // Verify URIs
        assertEq(collection721.tokenURI(1), uris[0]);
        assertEq(collection721.tokenURI(2), uris[1]);
        assertEq(collection721.tokenURI(3), uris[2]);
        
        // Verify total supply
        assertEq(collection721.totalSupply(), 3);
    }

    function test_erc721_airdrop_empty_uris() public {
        string[] memory uris = new string[](2);
        uris[0] = ""; // Empty URI
        uris[1] = ""; // Empty URI
        
        address[] memory twoRecipients = new address[](2);
        twoRecipients[0] = recipients[0];
        twoRecipients[1] = recipients[1];
        
        vm.prank(owner);
        uint256[] memory tokenIds = collection721.airdrop(twoRecipients, uris);
        
        assertEq(tokenIds.length, 2);
        assertEq(collection721.ownerOf(tokenIds[0]), recipients[0]);
        assertEq(collection721.ownerOf(tokenIds[1]), recipients[1]);
    }

    function test_erc721_airdrop_large_batch() public {
        // Airdrop to all 10 recipients
        string[] memory uris = new string[](10);
        for (uint256 i = 0; i < 10; i++) {
            uris[i] = string(abi.encodePacked("ipfs://token", vm.toString(i)));
        }
        
        vm.prank(owner);
        uint256[] memory tokenIds = collection721.airdrop(recipients, uris);
        
        assertEq(tokenIds.length, 10);
        assertEq(collection721.totalSupply(), 10);
        
        // Verify each recipient got exactly one token
        for (uint256 i = 0; i < 10; i++) {
            assertEq(collection721.balanceOf(recipients[i]), 1);
            assertEq(collection721.ownerOf(tokenIds[i]), recipients[i]);
        }
    }

    function test_erc721_airdrop_very_large_batch() public {
        // Test with 200 recipients (within gas limits)
        address[] memory manyRecipients = new address[](200);
        string[] memory manyUris = new string[](200);
        
        for (uint160 i = 0; i < 200; i++) {
            manyRecipients[i] = address(1000 + i);
            manyUris[i] = string(abi.encodePacked("ipfs://mass-airdrop-", vm.toString(uint256(i))));
        }
        
        vm.prank(owner);
        uint256[] memory tokenIds = collection721.airdrop(manyRecipients, manyUris);
        
        assertEq(tokenIds.length, 200);
        assertEq(collection721.totalSupply(), 200);
        
        // Spot check a few recipients
        assertEq(collection721.ownerOf(tokenIds[0]), manyRecipients[0]);
        assertEq(collection721.ownerOf(tokenIds[99]), manyRecipients[99]);
        assertEq(collection721.ownerOf(tokenIds[199]), manyRecipients[199]);
    }

    function test_erc721_airdrop_reverts_non_owner() public {
        address[] memory oneRecipient = new address[](1);
        oneRecipient[0] = recipients[0];
        
        string[] memory oneUri = new string[](1);
        oneUri[0] = "ipfs://test";
        
        vm.prank(recipients[0]);
        vm.expectRevert();
        collection721.airdrop(oneRecipient, oneUri);
    }

    function test_erc721_airdrop_reverts_empty_recipients() public {
        address[] memory empty = new address[](0);
        string[] memory emptyUris = new string[](0);
        
        vm.prank(owner);
        vm.expectRevert("No recipients");
        collection721.airdrop(empty, emptyUris);
    }

    function test_erc721_airdrop_reverts_length_mismatch() public {
        address[] memory twoRecipients = new address[](2);
        twoRecipients[0] = recipients[0];
        twoRecipients[1] = recipients[1];
        
        string[] memory oneUri = new string[](1);
        oneUri[0] = "ipfs://test";
        
        vm.prank(owner);
        vm.expectRevert("Length mismatch");
        collection721.airdrop(twoRecipients, oneUri);
    }

    function test_erc721_airdrop_reverts_batch_too_large() public {
        address[] memory tooMany = new address[](501);
        string[] memory tooManyUris = new string[](501);
        
        for (uint160 i = 0; i < 501; i++) {
            tooMany[i] = address(2000 + i);
            tooManyUris[i] = "ipfs://test";
        }
        
        vm.prank(owner);
        vm.expectRevert("Batch too large");
        collection721.airdrop(tooMany, tooManyUris);
    }

    function test_erc721_airdrop_reverts_zero_address_recipient() public {
        address[] memory invalidRecipients = new address[](3);
        invalidRecipients[0] = recipients[0];
        invalidRecipients[1] = address(0); // Invalid
        invalidRecipients[2] = recipients[2];
        
        string[] memory uris = new string[](3);
        for (uint256 i = 0; i < 3; i++) {
            uris[i] = "ipfs://test";
        }
        
        vm.prank(owner);
        vm.expectRevert("Invalid recipient");
        collection721.airdrop(invalidRecipients, uris);
    }

    function test_erc721_airdrop_same_recipient_multiple_times() public {
        // Same person can receive multiple tokens in one airdrop
        address[] memory sameRecipient = new address[](3);
        sameRecipient[0] = recipients[0];
        sameRecipient[1] = recipients[0];
        sameRecipient[2] = recipients[0];
        
        string[] memory uris = new string[](3);
        uris[0] = "ipfs://a";
        uris[1] = "ipfs://b";
        uris[2] = "ipfs://c";
        
        vm.prank(owner);
        uint256[] memory tokenIds = collection721.airdrop(sameRecipient, uris);
        
        // Recipient should own all 3 tokens
        assertEq(collection721.balanceOf(recipients[0]), 3);
        assertEq(collection721.ownerOf(tokenIds[0]), recipients[0]);
        assertEq(collection721.ownerOf(tokenIds[1]), recipients[0]);
        assertEq(collection721.ownerOf(tokenIds[2]), recipients[0]);
    }

    function test_erc721_airdrop_sequential_after_regular_mint() public {
        // Mint a token first
        vm.prank(owner);
        uint256 firstToken = collection721.mint(recipients[0], "ipfs://first");
        assertEq(firstToken, 1);
        
        // Then airdrop
        address[] memory twoRecipients = new address[](2);
        twoRecipients[0] = recipients[1];
        twoRecipients[1] = recipients[2];
        
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://second";
        uris[1] = "ipfs://third";
        
        vm.prank(owner);
        uint256[] memory tokenIds = collection721.airdrop(twoRecipients, uris);
        
        // Token IDs should be sequential
        assertEq(tokenIds[0], 2);
        assertEq(tokenIds[1], 3);
        assertEq(collection721.totalSupply(), 3);
    }

    // === ERC1155 Airdrop Tests ===

    function test_erc1155_airdrop_basic() public {
        // Create a token first
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 1000, 10000, "ipfs://edition");
        
        // Airdrop to 3 recipients
        address[] memory threeRecipients = new address[](3);
        threeRecipients[0] = recipients[0];
        threeRecipients[1] = recipients[1];
        threeRecipients[2] = recipients[2];
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 10;
        amounts[1] = 20;
        amounts[2] = 15;
        
        vm.prank(owner);
        collection1155.airdrop(threeRecipients, tokenId, amounts);
        
        // Verify balances
        assertEq(collection1155.balanceOf(recipients[0], tokenId), 10);
        assertEq(collection1155.balanceOf(recipients[1], tokenId), 20);
        assertEq(collection1155.balanceOf(recipients[2], tokenId), 15);
        
        // Verify total minted increased by sum of amounts
        assertEq(collection1155.totalMinted(tokenId), 1000 + 10 + 20 + 15);
    }

    function test_erc1155_airdrop_large_batch() public {
        // Create unlimited supply token
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://unlimited");
        
        // Airdrop to all 10 recipients with varying amounts
        uint256[] memory amounts = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            amounts[i] = (i + 1) * 5; // 5, 10, 15, ... 50
        }
        
        vm.prank(owner);
        collection1155.airdrop(recipients, tokenId, amounts);
        
        // Verify each recipient got correct amount
        for (uint256 i = 0; i < 10; i++) {
            assertEq(collection1155.balanceOf(recipients[i], tokenId), amounts[i]);
        }
        
        // Verify total minted
        uint256 expectedTotal = 100; // Initial mint
        for (uint256 i = 0; i < 10; i++) {
            expectedTotal += amounts[i];
        }
        assertEq(collection1155.totalMinted(tokenId), expectedTotal);
    }

    function test_erc1155_airdrop_respects_max_supply() public {
        // Create limited supply token
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 50, 100, "ipfs://limited");
        
        // Try to airdrop more than remaining supply
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 20;
        amounts[1] = 20;
        amounts[2] = 20; // Total 60, but only 50 remaining (100 - 50)
        
        address[] memory threeRecipients = new address[](3);
        threeRecipients[0] = recipients[0];
        threeRecipients[1] = recipients[1];
        threeRecipients[2] = recipients[2];
        
        vm.prank(owner);
        vm.expectRevert("Exceeds max supply");
        collection1155.airdrop(threeRecipients, tokenId, amounts);
    }

    function test_erc1155_airdrop_exact_max_supply() public {
        // Create limited supply token
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 50, 100, "ipfs://limited");
        
        // Airdrop exactly the remaining supply
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 25;
        amounts[1] = 25; // Total 50, exactly the remaining
        
        address[] memory twoRecipients = new address[](2);
        twoRecipients[0] = recipients[0];
        twoRecipients[1] = recipients[1];
        
        vm.prank(owner);
        collection1155.airdrop(twoRecipients, tokenId, amounts);
        
        // Verify total minted equals max supply
        assertEq(collection1155.totalMinted(tokenId), 100);
        assertEq(collection1155.maxSupply(tokenId), 100);
    }

    function test_erc1155_airdrop_reverts_non_owner() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://test");
        
        address[] memory oneRecipient = new address[](1);
        oneRecipient[0] = recipients[0];
        
        uint256[] memory oneAmount = new uint256[](1);
        oneAmount[0] = 10;
        
        vm.prank(recipients[0]);
        vm.expectRevert();
        collection1155.airdrop(oneRecipient, tokenId, oneAmount);
    }

    function test_erc1155_airdrop_reverts_empty_recipients() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://test");
        
        address[] memory empty = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);
        
        vm.prank(owner);
        vm.expectRevert("No recipients");
        collection1155.airdrop(empty, tokenId, emptyAmounts);
    }

    function test_erc1155_airdrop_reverts_length_mismatch() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://test");
        
        address[] memory twoRecipients = new address[](2);
        twoRecipients[0] = recipients[0];
        twoRecipients[1] = recipients[1];
        
        uint256[] memory oneAmount = new uint256[](1);
        oneAmount[0] = 10;
        
        vm.prank(owner);
        vm.expectRevert("Length mismatch");
        collection1155.airdrop(twoRecipients, tokenId, oneAmount);
    }

    function test_erc1155_airdrop_reverts_batch_too_large() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://test");
        
        address[] memory tooMany = new address[](501);
        uint256[] memory tooManyAmounts = new uint256[](501);
        
        for (uint160 i = 0; i < 501; i++) {
            tooMany[i] = address(2000 + i);
            tooManyAmounts[i] = 1;
        }
        
        vm.prank(owner);
        vm.expectRevert("Batch too large");
        collection1155.airdrop(tooMany, tokenId, tooManyAmounts);
    }

    function test_erc1155_airdrop_reverts_unknown_token() public {
        uint256 nonExistentToken = 999;
        
        address[] memory oneRecipient = new address[](1);
        oneRecipient[0] = recipients[0];
        
        uint256[] memory oneAmount = new uint256[](1);
        oneAmount[0] = 10;
        
        vm.prank(owner);
        vm.expectRevert("Unknown token");
        collection1155.airdrop(oneRecipient, nonExistentToken, oneAmount);
    }

    function test_erc1155_airdrop_reverts_zero_amount() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://test");
        
        address[] memory twoRecipients = new address[](2);
        twoRecipients[0] = recipients[0];
        twoRecipients[1] = recipients[1];
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 0; // Invalid
        
        vm.prank(owner);
        vm.expectRevert("Amount must be > 0");
        collection1155.airdrop(twoRecipients, tokenId, amounts);
    }

    function test_erc1155_airdrop_reverts_zero_address_recipient() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://test");
        
        address[] memory invalidRecipients = new address[](2);
        invalidRecipients[0] = recipients[0];
        invalidRecipients[1] = address(0); // Invalid
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 10;
        
        vm.prank(owner);
        vm.expectRevert("Invalid recipient");
        collection1155.airdrop(invalidRecipients, tokenId, amounts);
    }

    function test_erc1155_airdrop_same_recipient_multiple_times() public {
        vm.prank(owner);
        uint256 tokenId = collection1155.mint(owner, 100, 0, "ipfs://test");
        
        // Same recipient appears multiple times
        address[] memory sameRecipient = new address[](3);
        sameRecipient[0] = recipients[0];
        sameRecipient[1] = recipients[0];
        sameRecipient[2] = recipients[0];
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 10;
        amounts[1] = 20;
        amounts[2] = 15;
        
        vm.prank(owner);
        collection1155.airdrop(sameRecipient, tokenId, amounts);
        
        // Recipient should have sum of all amounts
        assertEq(collection1155.balanceOf(recipients[0], tokenId), 10 + 20 + 15);
    }
}
