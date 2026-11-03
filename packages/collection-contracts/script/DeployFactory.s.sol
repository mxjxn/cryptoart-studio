// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {SuchCollectionFactory} from "../src/SuchCollectionFactory.sol";
import {SuchCollection1155Factory} from "../src/SuchCollection1155Factory.sol";

/// @notice Deploys ERC-721 and ERC-1155 factories with the same platform owner.
/// Env: PLATFORM_OWNER_ADDRESS
contract DeployFactory is Script {
    function run() external {
        address platformOwner = vm.envAddress("PLATFORM_OWNER_ADDRESS");

        vm.startBroadcast();
        SuchCollectionFactory factory721 = new SuchCollectionFactory(platformOwner);
        SuchCollection1155Factory factory1155 = new SuchCollection1155Factory(platformOwner);
        vm.stopBroadcast();

        console.log("SuchCollectionFactory (ERC-721) deployed at:", address(factory721));
        console.log("SuchCollection1155Factory (ERC-1155) deployed at:", address(factory1155));
        console.log("platformOwner:", platformOwner);
    }
}
