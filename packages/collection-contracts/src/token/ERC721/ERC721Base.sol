// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {ERC721Core} from "./ERC721Core.sol";

abstract contract ERC721Base is ERC721Core {
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }
}
