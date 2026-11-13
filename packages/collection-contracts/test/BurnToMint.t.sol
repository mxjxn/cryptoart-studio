// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {SuchCollection1155} from "../src/SuchCollection1155.sol";
import {BurnToMintExtension} from "../src/BurnToMintExtension.sol";

// Mock ERC721 that supports burning
contract MockBurnableERC721 {
    mapping(uint256 => address) private _owners;
    mapping(uint256 => bool) public burned;
    uint256 public nextTokenId = 1;
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }
    
    function mint(address to) external returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _owners[tokenId] = to;
        return tokenId;
    }
    
    function burn(uint256 tokenId) external {
        require(_owners[tokenId] != address(0), "Token does not exist");
        burned[tokenId] = true;
        delete _owners[tokenId];
    }
    
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "Not owner");
        _owners[tokenId] = to;
    }
}

// Mock ERC721 without burn function
contract MockNonBurnableERC721 {
    mapping(uint256 => address) private _owners;
    uint256 public nextTokenId = 1;
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }
    
    function mint(address to) external returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _owners[tokenId] = to;
        return tokenId;
    }
    
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "Not owner");
        _owners[tokenId] = to;
    }
}

// Mock ERC1155
contract MockERC1155 {
    mapping(address => mapping(uint256 => uint256)) public balanceOf;
    uint256 public nextTokenId = 1;
    
    function mint(address to, uint256 tokenId, uint256 amount) external {
        balanceOf[to][tokenId] += amount;
    }
    
    function burn(address from, uint256 tokenId, uint256 amount) external {
        require(balanceOf[from][tokenId] >= amount, "Insufficient balance");
        balanceOf[from][tokenId] -= amount;
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes calldata) external {
        require(balanceOf[from][tokenId] >= amount, "Insufficient balance");
        balanceOf[from][tokenId] -= amount;
        balanceOf[to][tokenId] += amount;
    }
}

/**
 * @title BurnToMintTest
 * @notice Comprehensive tests for burn-to-mint functionality
 */
contract BurnToMintTest is Test {
    BurnToMintExtension public extension;
    SuchCollection public targetCollection721;
    SuchCollection1155 public targetCollection1155;
    
    MockBurnableERC721 public burnableSource721;
    MockNonBurnableERC721 public nonBurnableSource721;
    MockERC1155 public source1155;
    
    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address payable public royaltyReceiver = payable(address(0x6));
    
    event BurnedToMint(
        uint256 indexed configId,
        address indexed user,
        uint256 burnedAmount,
        uint256 mintedAmount,
        uint256[] mintedTokenIds
    );

    function setUp() public {
        extension = new BurnToMintExtension(owner);
        
        // Deploy target collections
        targetCollection721 = new SuchCollection("Target 721", "TGT", owner, royaltyReceiver, 500);
        targetCollection1155 = new SuchCollection1155("Target 1155", "TGT1155", owner, royaltyReceiver, 500);
        
        // Register extension with collections
        vm.startPrank(owner);
        targetCollection721.registerExtension(address(extension), "");
        // For 1155, create a token and authorize the extension
        targetCollection1155.mint(owner, 1000, 0, "ipfs://target-token");
        targetCollection1155.setAuthorizedMinter(address(extension), true);
        vm.stopPrank();
        
        // Deploy source contracts
        burnableSource721 = new MockBurnableERC721();
        nonBurnableSource721 = new MockNonBurnableERC721();
        source1155 = new MockERC1155();
        
        // Mint some source tokens to alice
        burnableSource721.mint(alice);
        burnableSource721.mint(alice);
        burnableSource721.mint(alice);
        
        nonBurnableSource721.mint(alice);
        nonBurnableSource721.mint(alice);
        
        source1155.mint(alice, 1, 100);
    }

    // === Configuration Tests ===

    function test_createBurnConfig_721_to_721() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0, // Not used for ERC721 target
            1, // 1:1 ratio
            1,
            true // Has burn function
        );
        
        assertEq(configId, 0);
        
        BurnToMintExtension.BurnConfig memory config = extension.getBurnConfig(0);
        assertEq(config.sourceContract, address(burnableSource721));
        assertEq(config.targetCollection, address(targetCollection721));
        assertTrue(config.isActive);
    }

    function test_createBurnConfig_721_to_1155() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection1155),
            BurnToMintExtension.TokenSpec.ERC1155,
            1, // Target token ID
            1,
            1,
            true
        );
        
        assertEq(configId, 0);
    }

    function test_createBurnConfig_1155_to_721() public {
        vm.prank(owner);
        extension.createBurnConfig(
            address(source1155),
            BurnToMintExtension.TokenSpec.ERC1155,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            2, // Burn 2 source for 1 target
            1,
            true
        );
    }

    function test_createBurnConfig_reverts_non_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            1,
            true
        );
    }

    function test_createBurnConfig_reverts_zero_source() public {
        vm.prank(owner);
        vm.expectRevert("Invalid source");
        extension.createBurnConfig(
            address(0),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            1,
            true
        );
    }

    function test_createBurnConfig_reverts_zero_ratios() public {
        vm.startPrank(owner);
        
        vm.expectRevert("Burn ratio must be > 0");
        extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            0, // Invalid
            1,
            true
        );
        
        vm.expectRevert("Mint ratio must be > 0");
        extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            0, // Invalid
            true
        );
        
        vm.stopPrank();
    }

    function test_setBurnConfigActive() public {
        vm.startPrank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            1,
            true
        );
        
        extension.setBurnConfigActive(configId, false);
        vm.stopPrank();
        
        BurnToMintExtension.BurnConfig memory config = extension.getBurnConfig(configId);
        assertFalse(config.isActive);
    }

    // === Burn-to-Mint Tests: ERC721 Source with Burn ===

    function test_burnToMint_721_to_721_with_burn() public {
        // Create config
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1, // 1:1 ratio
            1,
            true
        );
        
        // Alice burns token 1 to mint
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new-token";
        
        vm.prank(alice);
        uint256[] memory mintedIds = extension.burnToMint(configId, tokenIds, 0, 0, uris);
        
        // Verify source was burned
        assertTrue(burnableSource721.burned(1));
        
        // Verify target was minted
        assertEq(mintedIds.length, 1);
        assertEq(targetCollection721.ownerOf(mintedIds[0]), alice);
    }

    function test_burnToMint_721_to_721_multiple_burns() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            2, // Burn 2 to mint 1
            1,
            true
        );
        
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new";
        
        vm.prank(alice);
        uint256[] memory mintedIds = extension.burnToMint(configId, tokenIds, 0, 0, uris);
        
        assertEq(mintedIds.length, 1);
        assertTrue(burnableSource721.burned(1));
        assertTrue(burnableSource721.burned(2));
    }

    // === Burn-to-Mint Tests: ERC721 Source without Burn ===

    function test_burnToMint_721_to_721_transfer_to_dead() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(nonBurnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            1,
            false // No burn function
        );
        
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new";
        
        vm.prank(alice);
        extension.burnToMint(configId, tokenIds, 0, 0, uris);
        
        // Verify transferred to dead address
        assertEq(nonBurnableSource721.ownerOf(1), extension.DEAD_ADDRESS());
    }

    // === Burn-to-Mint Tests: ERC1155 Source ===

    function test_burnToMint_1155_to_721() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(source1155),
            BurnToMintExtension.TokenSpec.ERC1155,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            10, // Burn 10 1155 to mint 1 721
            1,
            true
        );
        
        uint256[] memory tokenIds = new uint256[](0); // Not used for 1155
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new";
        
        vm.prank(alice);
        uint256[] memory mintedIds = extension.burnToMint(configId, tokenIds, 1, 10, uris);
        
        assertEq(mintedIds.length, 1);
        assertEq(source1155.balanceOf(alice, 1), 90); // 100 - 10 = 90
        assertEq(targetCollection721.ownerOf(mintedIds[0]), alice);
    }

    function test_burnToMint_1155_to_1155() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(source1155),
            BurnToMintExtension.TokenSpec.ERC1155,
            address(targetCollection1155),
            BurnToMintExtension.TokenSpec.ERC1155,
            1, // Target token ID
            5, // Burn 5 to mint
            2, // Get 2 per burn set
            true
        );
        
        uint256[] memory tokenIds = new uint256[](0);
        string[] memory uris = new string[](0);
        
        vm.prank(alice);
        extension.burnToMint(configId, tokenIds, 1, 10, uris); // Burn 10 = 2 sets = mint 4
        
        assertEq(source1155.balanceOf(alice, 1), 90);
        assertEq(targetCollection1155.balanceOf(alice, 1), 4);
    }

    // === Error Condition Tests ===

    function test_burnToMint_reverts_not_owner() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            1,
            true
        );
        
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new";
        
        // Bob doesn't own token 1
        vm.prank(bob);
        vm.expectRevert("Not token owner");
        extension.burnToMint(configId, tokenIds, 0, 0, uris);
    }

    function test_burnToMint_reverts_config_not_active() public {
        vm.startPrank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            1,
            true
        );
        
        extension.setBurnConfigActive(configId, false);
        vm.stopPrank();
        
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new";
        
        vm.prank(alice);
        vm.expectRevert("Config not active");
        extension.burnToMint(configId, tokenIds, 0, 0, uris);
    }

    function test_burnToMint_reverts_insufficient_burn_amount() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            5, // Need to burn 5
            1,
            true
        );
        
        uint256[] memory tokenIds = new uint256[](3); // Only burning 3
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        tokenIds[2] = 3;
        
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new";
        
        vm.prank(alice);
        vm.expectRevert("Insufficient burn amount");
        extension.burnToMint(configId, tokenIds, 0, 0, uris);
    }

    function test_burnToMint_reverts_uri_count_mismatch() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            2, // Will mint 2 tokens
            true
        );
        
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        
        string[] memory uris = new string[](1); // But only 1 URI provided
        uris[0] = "ipfs://new";
        
        vm.prank(alice);
        vm.expectRevert("URI count mismatch");
        extension.burnToMint(configId, tokenIds, 0, 0, uris);
    }

    // === User Burn Tracking Tests ===

    function test_userBurnCount_tracking() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            1,
            1,
            true
        );
        
        assertEq(extension.getUserBurnCount(configId, alice), 0);
        
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://new";
        
        vm.prank(alice);
        extension.burnToMint(configId, tokenIds, 0, 0, uris);
        
        assertEq(extension.getUserBurnCount(configId, alice), 1);
    }

    // === Complex Ratio Tests ===

    function test_burnToMint_complex_ratio() public {
        vm.prank(owner);
        uint256 configId = extension.createBurnConfig(
            address(burnableSource721),
            BurnToMintExtension.TokenSpec.ERC721,
            address(targetCollection721),
            BurnToMintExtension.TokenSpec.ERC721,
            0,
            2, // Burn 2
            3, // Get 3
            true
        );
        
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        
        string[] memory uris = new string[](3);
        uris[0] = "ipfs://1";
        uris[1] = "ipfs://2";
        uris[2] = "ipfs://3";
        
        vm.prank(alice);
        uint256[] memory mintedIds = extension.burnToMint(configId, tokenIds, 0, 0, uris);
        
        assertEq(mintedIds.length, 3);
        assertEq(extension.getUserBurnCount(configId, alice), 2);
    }
}
