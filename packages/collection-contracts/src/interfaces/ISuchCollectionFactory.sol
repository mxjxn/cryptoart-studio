// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

interface ISuchCollectionFactory {
    event CollectionCreated(address indexed collection, address indexed owner, string name, string symbol);

    function createCollection(
        string calldata name,
        string calldata symbol,
        address payable royaltyReceiver,
        uint16 royaltyBPS
    ) external returns (address);

    function getCollectionsByArtist(address artist) external view returns (address[] memory);
    function getAllCollections() external view returns (address[] memory);
    function collectionCount() external view returns (uint256);
}
