// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IGenerativeParametersExtension {
    event GenerativeMinted(address indexed to, uint256 indexed tokenId, bytes32 seed, uint256 mintIndex);
    event CollectionParameterSet(bytes32 indexed key, bytes32 value);
    event TokenParameterSet(uint256 indexed tokenId, bytes32 indexed key, bytes32 value);
    event CollectionParamsBlobSet(bytes params);
    event TokenParamsBlobSet(uint256 indexed tokenId, bytes params);
    event CustomDerivedRegistered(bytes32 indexed key, address handler);

    function mint(address to, string calldata uri, bytes calldata paramsBlob)
        external
        returns (uint256 tokenId);

    function setCollectionParameter(bytes32 key, bytes32 value) external;

    function setTokenParameter(uint256 tokenId, bytes32 key, bytes32 value) external;

    function setCollectionParamsBlob(bytes calldata params) external;

    function setTokenParamsBlob(uint256 tokenId, bytes calldata params) external;

    function getParameter(uint256 tokenId, bytes32 key) external view returns (bytes32);

    function getDerivedValue(uint256 tokenId, bytes32 key) external view returns (bytes32);

    function seed(uint256 tokenId) external view returns (bytes32);

    function mintRecordCount() external view returns (uint256);

    function registerCustomDerived(bytes32 key, address handler) external;
}