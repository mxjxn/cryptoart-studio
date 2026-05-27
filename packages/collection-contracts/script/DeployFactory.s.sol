// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {SuchCollectionFactory} from "../src/SuchCollectionFactory.sol";

contract DeployFactory is Script {
    function run() external {
        address platformOwner = vm.envAddress("PLATFORM_OWNER_ADDRESS");

        vm.startBroadcast();
        SuchCollectionFactory factory = new SuchCollectionFactory(platformOwner);
        console.log("SuchCollectionFactory deployed at:", address(factory));
        vm.stopBroadcast();
    }
}
