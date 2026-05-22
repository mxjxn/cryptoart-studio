// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {EnumerableSet} from "openzeppelin/utils/structs/EnumerableSet.sol";
import {CreatorCore} from "./CreatorCore.sol";

abstract contract ERC721CreatorCore is CreatorCore {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint16 private _extensionCounter;
    mapping(address => uint16) internal _extensionToIndex;
    mapping(uint16 => address) internal _indexToExtension;

    function _registerExtension(address extension, string calldata baseURI) internal override {
        require(_extensionCounter < 0xFFFF, "Too many extensions");
        if (_extensionToIndex[extension] == 0) {
            ++_extensionCounter;
            _extensionToIndex[extension] = _extensionCounter;
            _indexToExtension[_extensionCounter] = extension;
        }
        super._registerExtension(extension, baseURI);
    }

    function _preMintBase(address, uint256) internal virtual {}

    function _preMintExtension(address, uint256) internal virtual {}
}
