// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {SuchCollectionFactory} from "../src/SuchCollectionFactory.sol";
import {SuchCollection} from "../src/SuchCollection.sol";
import {SuchCollection1155Factory} from "../src/SuchCollection1155Factory.sol";
import {SuchCollection1155} from "../src/SuchCollection1155.sol";

/// @notice Local anvil proof: deploy both factories, create collections, mint.
contract LocalE2E is Script {
    function run() external {
        // Default platform owner = anvil account #0
        address platformOwner =
            vm.envOr("PLATFORM_OWNER_ADDRESS", address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266));
        uint256 deployerKey =
            vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address artist = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        SuchCollectionFactory factory721 = new SuchCollectionFactory(platformOwner);
        SuchCollection1155Factory factory1155 = new SuchCollection1155Factory(platformOwner);

        address c721 = factory721.createCollection("OneOnes", "ONE", payable(artist), 1000);
        address c1155 = factory1155.createCollection("MultiSupply", "MULTI", payable(artist), 1000);

        SuchCollection(c721).mint(artist, "ar://metadata-721");
        SuchCollection1155(c1155).mint(artist, 10, 100, "ar://metadata-1155-limited");
        SuchCollection1155(c1155).mint(artist, 1, 0, "ar://metadata-1155-open");

        vm.stopBroadcast();

        console.log("PLATFORM_OWNER", platformOwner);
        console.log("ARTIST", artist);
        console.log("FACTORY_721", address(factory721));
        console.log("FACTORY_1155", address(factory1155));
        console.log("COLLECTION_721", c721);
        console.log("COLLECTION_1155", c1155);
        console.log("SUPPLY_721", SuchCollection(c721).totalSupply());
        console.log("SUPPLY_1155_IDS", SuchCollection1155(c1155).totalSupply());
        console.log("TOKEN1_MINTED", SuchCollection1155(c1155).totalMinted(1));
        console.log("TOKEN2_MINTED", SuchCollection1155(c1155).totalMinted(2));
    }
}
