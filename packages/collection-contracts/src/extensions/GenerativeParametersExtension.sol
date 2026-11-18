// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "openzeppelin/access/Ownable.sol";
import {ISuchCollection} from "../interfaces/ISuchCollection.sol";
import {GenerativeDerived} from "./GenerativeDerived.sol";
import {IGenerativeParametersExtension} from "./IGenerativeParametersExtension.sol";

interface IGenerativeDerivedHandler {
    function derive(bytes32 key, uint256 tokenId) external view returns (bytes32);
}

/// @title GenerativeParametersExtension
/// @notice Creator-core extension that mints generative HTML tokens and stores mint-time + artist parameters.
/// @dev Mint URIs typically point at `text/html` on Arweave/IPFS. Viewers may read derived values via RPC and/or URL params.
contract GenerativeParametersExtension is Ownable, IGenerativeParametersExtension {
    ISuchCollection public immutable collection;

    uint256 public mintRecordCount;

    struct MintRecord {
        uint256 mintIndex;
        uint64 mintBlock;
        uint64 mintTimestamp;
        bytes32 mintBlockHash;
    }

    mapping(uint256 => MintRecord) internal _mintRecords;
    mapping(bytes32 => bytes32) internal _collectionParams;
    mapping(uint256 => mapping(bytes32 => bytes32)) internal _tokenParams;
    bytes internal _collectionParamsBlob;
    mapping(uint256 => bytes) internal _tokenParamsBlob;
    mapping(bytes32 => address) internal _customDerivedHandlers;

    error NotTokenMinter();
    error UnknownDerivedKey();
    error InvalidHandler();

    constructor(address collection_, address owner_) Ownable(owner_) {
        collection = ISuchCollection(collection_);
    }

    function mint(address to, string calldata uri, bytes calldata paramsBlob)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        tokenId = collection.mintExtension(to, uri);
        bytes32 seedValue = _recordMint(tokenId);
        if (paramsBlob.length > 0) {
            _tokenParamsBlob[tokenId] = paramsBlob;
            emit TokenParamsBlobSet(tokenId, paramsBlob);
        }
        emit GenerativeMinted(to, tokenId, seedValue, _mintRecords[tokenId].mintIndex);
    }

    function setCollectionParameter(bytes32 key, bytes32 value) external onlyOwner {
        _collectionParams[key] = value;
        emit CollectionParameterSet(key, value);
    }

    function setTokenParameter(uint256 tokenId, bytes32 key, bytes32 value) external onlyOwner {
        _requireMintedByExtension(tokenId);
        _tokenParams[tokenId][key] = value;
        emit TokenParameterSet(tokenId, key, value);
    }

    function setCollectionParamsBlob(bytes calldata params) external onlyOwner {
        _collectionParamsBlob = params;
        emit CollectionParamsBlobSet(params);
    }

    function setTokenParamsBlob(uint256 tokenId, bytes calldata params) external onlyOwner {
        _requireMintedByExtension(tokenId);
        _tokenParamsBlob[tokenId] = params;
        emit TokenParamsBlobSet(tokenId, params);
    }

    function registerCustomDerived(bytes32 key, address handler) external onlyOwner {
        if (handler != address(0) && handler.code.length == 0) revert InvalidHandler();
        _customDerivedHandlers[key] = handler;
        emit CustomDerivedRegistered(key, handler);
    }

    function collectionParamsBlob() external view returns (bytes memory) {
        return _collectionParamsBlob;
    }

    function tokenParamsBlob(uint256 tokenId) external view returns (bytes memory) {
        _requireMintedByExtension(tokenId);
        return _tokenParamsBlob[tokenId];
    }

    function getParameter(uint256 tokenId, bytes32 key) external view returns (bytes32) {
        _requireMintedByExtension(tokenId);
        bytes32 tokenValue = _tokenParams[tokenId][key];
        if (tokenValue != bytes32(0)) return tokenValue;
        return _collectionParams[key];
    }

    function getDerivedValue(uint256 tokenId, bytes32 key) external view returns (bytes32) {
        _requireMintedByExtension(tokenId);
        address handler = _customDerivedHandlers[key];
        if (handler != address(0)) {
            return IGenerativeDerivedHandler(handler).derive(key, tokenId);
        }
        return _builtinDerived(tokenId, key);
    }

    function seed(uint256 tokenId) public view returns (bytes32) {
        _requireMintedByExtension(tokenId);
        MintRecord memory record = _mintRecords[tokenId];
        return keccak256(abi.encodePacked(tokenId, record.mintBlockHash, record.mintIndex));
    }

    function builtinDerivedKeys() external pure returns (bytes32[] memory) {
        return GenerativeDerived.builtinKeys();
    }

    function _recordMint(uint256 tokenId) internal returns (bytes32 seedValue) {
        unchecked {
            ++mintRecordCount;
        }
        uint256 mintIndex = mintRecordCount;
        bytes32 blockHash = blockhash(block.number);
        _mintRecords[tokenId] = MintRecord({
            mintIndex: mintIndex,
            mintBlock: uint64(block.number),
            mintTimestamp: uint64(block.timestamp),
            mintBlockHash: blockHash
        });
        seedValue = keccak256(abi.encodePacked(tokenId, blockHash, mintIndex));
    }

    function _builtinDerived(uint256 tokenId, bytes32 key) internal view returns (bytes32) {
        MintRecord memory record = _mintRecords[tokenId];
        if (key == GenerativeDerived.TOKEN_ID) return bytes32(tokenId);
        if (key == GenerativeDerived.SEED) return seed(tokenId);
        if (key == GenerativeDerived.MINT_BLOCK) return bytes32(uint256(record.mintBlock));
        if (key == GenerativeDerived.MINT_TIMESTAMP) return bytes32(uint256(record.mintTimestamp));
        if (key == GenerativeDerived.MINT_BLOCK_HASH) return record.mintBlockHash;
        if (key == GenerativeDerived.MINT_INDEX) return bytes32(record.mintIndex);
        if (key == GenerativeDerived.EXTENSION_MINT_COUNT) return bytes32(mintRecordCount);
        if (key == GenerativeDerived.CURRENT_BLOCK) return bytes32(block.number);
        if (key == GenerativeDerived.CURRENT_TIMESTAMP) return bytes32(block.timestamp);
        revert UnknownDerivedKey();
    }

    function _requireMintedByExtension(uint256 tokenId) internal view {
        if (_mintRecords[tokenId].mintIndex == 0) revert NotTokenMinter();
    }
}