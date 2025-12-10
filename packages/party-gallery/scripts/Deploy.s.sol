// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import {GalleryNFT} from "../contracts/GalleryNFT.sol";
import {GalleryAccount} from "../contracts/GalleryAccount.sol";
import {PartyGalleryFactory} from "../contracts/PartyGalleryFactory.sol";

/**
 * @title Deploy
 * @notice Deployment script for the Party Gallery system
 *
 * Usage:
 *   forge script scripts/Deploy.s.sol --rpc-url base --broadcast --verify
 */
contract Deploy is Script {
    // ERC-6551 Registry (same address on all chains)
    // See: https://docs.tokenbound.org/contracts/deployments
    address constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;

    // Deployed addresses (filled after deployment)
    GalleryAccount public galleryAccountImpl;
    GalleryNFT public galleryNFT;
    PartyGalleryFactory public factory;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy the GalleryAccount implementation
        galleryAccountImpl = new GalleryAccount();
        console.log("GalleryAccount implementation:", address(galleryAccountImpl));

        // 2. Deploy GalleryNFT with registry and account implementation
        galleryNFT = new GalleryNFT(ERC6551_REGISTRY, address(galleryAccountImpl));
        console.log("GalleryNFT:", address(galleryNFT));

        // 3. Deploy the factory
        factory = new PartyGalleryFactory(
            address(galleryNFT),
            ERC6551_REGISTRY,
            address(galleryAccountImpl)
        );
        console.log("PartyGalleryFactory:", address(factory));

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("ERC-6551 Registry:", ERC6551_REGISTRY);
        console.log("GalleryAccount Impl:", address(galleryAccountImpl));
        console.log("GalleryNFT:", address(galleryNFT));
        console.log("PartyGalleryFactory:", address(factory));
    }
}

/**
 * @title DeployTestnet
 * @notice Deployment script for testnets with additional test helpers
 */
contract DeployTestnet is Deploy {
    function run() external override {
        // Run base deployment
        super.run();

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Create a test gallery for verification
        (uint256 tokenId, address account) = galleryNFT.createGallery(
            "Test Gallery",
            "A test gallery for verification",
            "https://cryptoart.studio/gallery/test"
        );

        console.log("\n=== Test Gallery Created ===");
        console.log("Token ID:", tokenId);
        console.log("6551 Account:", account);

        vm.stopBroadcast();
    }
}
