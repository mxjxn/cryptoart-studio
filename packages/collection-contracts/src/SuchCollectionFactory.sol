// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {Ownable} from "openzeppelin/access/Ownable.sol";
import {SuchCollection} from "./SuchCollection.sol";

contract SuchCollectionFactory is Ownable {
    address[] public collections;
    mapping(address => address) public collectionOwner;
    mapping(address => address[]) public artistCollections;

    event CollectionCreated(address indexed collection, address indexed owner, string name, string symbol);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function createCollection(
        string calldata name,
        string calldata symbol,
        address payable royaltyReceiver,
        uint16 royaltyBPS
    ) external returns (address) {
        SuchCollection newCollection = new SuchCollection(name, symbol, msg.sender, royaltyReceiver, royaltyBPS);
        address collectionAddr = address(newCollection);

        collections.push(collectionAddr);
        collectionOwner[collectionAddr] = msg.sender;
        artistCollections[msg.sender].push(collectionAddr);

        emit CollectionCreated(collectionAddr, msg.sender, name, symbol);
        return collectionAddr;
    }

    function getCollectionsByArtist(address artist) external view returns (address[] memory) {
        return artistCollections[artist];
    }

    function getAllCollections() external view returns (address[] memory) {
        return collections;
    }

    function collectionCount() external view returns (uint256) {
        return collections.length;
    }
}
