// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {GenerativeParametersExtension} from "../src/extensions/GenerativeParametersExtension.sol";

/// @notice Broadcast helper for Max — reads COLLECTION and ARTIST_OWNER from env (see broadcast logs only).
contract DeployGenerativeExtension is Script {
    function run() external returns (address extension) {
        address collection = vm.envAddress("GENERATIVE_EXTENSION_COLLECTION");
        address artistOwner = vm.envAddress("GENERATIVE_EXTENSION_OWNER");
        vm.startBroadcast();
        extension = address(new GenerativeParametersExtension(collection, artistOwner));
        vm.stopBroadcast();
    }
}